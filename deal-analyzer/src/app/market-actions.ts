'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { dealsRepo } from '@/lib/deals-repo'
import { currentUser } from '@/lib/session'
import { AVATAR_PROPERTY_TYPES, validateAvatar, type Avatar, type AvatarPropertyType } from '@/market/engine/avatar'
import { CONFIGURABLE, STRATEGY_KEYS, type StrategyKey } from '@/market/engine/config'
import { MANUAL_METRICS, METRICS } from '@/market/engine/metrics'
import { CONFIDENCE_LEVELS, HARD_FLAG_SEVERITIES, type ConfidenceLevel, type GeoLevel, type HardFlagSeverity } from '@/market/engine/types'
import { liveContext, recordManualObservation, runIngestion } from '@/market/ingest/pipeline'
import { censusName } from '@/market/ingest/providers/census-acs'
import { providerById } from '@/market/ingest/registry'
import {
  avatarsRepo,
  CODE_RULES,
  configRepo,
  flagsRepo,
  geoRepo,
  outcomesRepo,
  promotionsRepo,
  samplesRepo,
  VersionConflictError,
} from '@/market/lib/repo'
import { analyzable, canAddChild, evaluateAll, promote } from '@/market/lib/service'
import { candidatesRepo } from '@/sourcing/lib/repo'

export interface FormState {
  ok?: string
  error?: string
  errors?: Record<string, string>
}

const NO_USER = 'Your session has ended — sign in again.'
const today = () => new Date().toISOString().slice(0, 10)
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const opt = (fd: FormData, k: string) => str(fd, k) || null
/** '' → null (UNKNOWN), a number → number, anything else → 'invalid'. Never turns blank into 0. */
function numOrNull(fd: FormData, k: string): number | null | 'invalid' {
  const v = str(fd, k).replace(/[$,\s]/g, '')
  if (v === '') return null
  const n = Number(v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : v)
  return Number.isFinite(n) ? n : 'invalid'
}
const oneOf = <T extends string>(v: string, list: readonly T[]): T | null => ((list as readonly string[]).includes(v) ? (v as T) : null)

function refreshMarkets(geoId?: string) {
  revalidatePath('/markets')
  if (geoId) revalidatePath(`/markets/${encodeURIComponent(geoId)}`)
}

// ---------------------------------------------------------------- evaluation & geography

export async function evaluateNow(): Promise<void> {
  const user = await currentUser()
  if (!user) return
  await evaluateAll(await getDb(), user.displayName, today())
  refreshMarkets()
  revalidatePath('/markets', 'layout')
}

export async function addGeography(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const level = oneOf(str(fd, 'level'), ['msa', 'submarket', 'zcta', 'tract', 'block_group', 'micro'] as const) as GeoLevel | null
  if (!level) return { error: 'Choose a level.' }
  const code = opt(fd, 'code')
  const parentId = opt(fd, 'parentId')
  const state = opt(fd, 'state')?.toUpperCase() ?? null
  let name = str(fd, 'name')
  const db = await getDb()
  if (CODE_RULES[level] && !(code && CODE_RULES[level]!.test(code))) return { error: `Enter the official ${level === 'msa' ? 'CBSA (5 digits)' : level === 'zcta' ? 'ZCTA (5 digits)' : 'GEOID'} code.` }
  if (state && !/^[A-Z]{2}$/.test(state)) return { error: 'State: two letters, e.g. TX.' }
  if (level !== 'msa') {
    if (!parentId) return { error: 'Choose the parent geography.' }
    if (!(await canAddChild(db, parentId))) return { error: 'Drill-down first: the parent must be promoted before its children are analyzed (VF-03 §17).' }
  }
  if (!name && (level === 'msa' || level === 'zcta') && code) {
    try {
      name = (await censusName(liveContext(), { id: '', level, code, state, name: '', parentId })) ?? ''
    } catch {
      name = ''
    }
  }
  if (!name) name = level === 'zcta' && code ? `ZIP ${code}` : ''
  if (!name) return { error: 'Enter a name (or set CENSUS_API_KEY to look it up).' }
  try {
    const id = await geoRepo(db).create({ level, code, name, parentId, state }, user.displayName)
    refreshMarkets(parentId ?? undefined)
    return { ok: `Added ${name} (${id}).` }
  } catch (e) {
    return { error: e instanceof Error && /duplicate|unique/i.test(e.message) ? 'That geography is already on file.' : e instanceof Error ? e.message : 'Could not add it.' }
  }
}

export async function ingest(fd: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) return
  const provider = providerById(str(fd, 'provider'))
  const db = await getDb()
  const geo = await geoRepo(db).get(str(fd, 'geoId'))
  if (!provider || !geo) return
  const parent = geo.parentId ? await geoRepo(db).get(geo.parentId) : null
  await runIngestion(db, provider, geo, user.displayName, liveContext(), parent)
  refreshMarkets(geo.id)
  revalidatePath('/markets/ingestion')
}

/** One provider for every analyzable geography it covers (sequential: respects rate limits). */
export async function ingestAll(fd: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) return
  const provider = providerById(str(fd, 'provider'))
  if (!provider) return
  const db = await getDb()
  const geos = await geoRepo(db).list()
  const byId = new Map(geos.map((g) => [g.id, g]))
  const promoted = new Set((await promotionsRepo(db).active()).keys())
  for (const g of geos.filter((x) => provider.levels.includes(x.level) && analyzable(x, byId, promoted)))
    await runIngestion(db, provider, g, user.displayName, liveContext(), g.parentId ? byId.get(g.parentId) : null)
  revalidatePath('/markets/ingestion')
  refreshMarkets()
}

export async function addManualObservation(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const geoId = str(fd, 'geoId')
  const metric = str(fd, 'metric')
  const def = MANUAL_METRICS.find((m) => m.key === metric)
  if (!def) return { error: 'Choose a metric.' }
  // Ratios are entered as percentages (20 = 20%); stored as fractions.
  const raw = Number(str(fd, 'value').replace(/[$,%\s]/g, ''))
  if (str(fd, 'value') === '' || !Number.isFinite(raw)) return { error: 'Enter a number.' }
  const value = def.unit === 'ratio' ? raw / 100 : raw
  const confidence = oneOf(str(fd, 'confidence'), CONFIDENCE_LEVELS) as ConfidenceLevel | null
  if (!confidence) return { error: 'Choose how strong the evidence is.' }
  const r = await recordManualObservation(
    await getDb(),
    {
      geoId,
      metric,
      value,
      unit: def.unit,
      source: str(fd, 'source'),
      sourceUrl: opt(fd, 'sourceUrl'),
      asOf: str(fd, 'asOf'),
      retrievedAt: new Date().toISOString(),
      confidence,
      methodology: opt(fd, 'methodology') ?? 'Entered by hand from the cited source',
    },
    user.displayName,
    today(),
  )
  refreshMarkets(geoId)
  if (r.status === 'rejected') return { error: `Not accepted: ${r.errors.join('; ')}` }
  if (r.status === 'duplicate') return { ok: 'That exact value is already on file.' }
  return { ok: `Recorded ${METRICS[metric].label}. Re-evaluate to update the scores.` }
}

export async function addFlag(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const severity = oneOf(str(fd, 'severity'), HARD_FLAG_SEVERITIES) as HardFlagSeverity | null
  const geoId = str(fd, 'geoId')
  if (!severity || !str(fd, 'category') || !str(fd, 'reason') || !str(fd, 'source')) return { error: 'Severity, category, reason and source are all required.' }
  const url = opt(fd, 'sourceUrl')
  if (url && !/^https?:\/\//i.test(url)) return { error: 'Source URL must start with http:// or https://' }
  await flagsRepo(await getDb()).add({ geoId, severity, category: str(fd, 'category'), reason: str(fd, 'reason'), source: str(fd, 'source'), sourceUrl: url }, user.displayName)
  refreshMarkets(geoId)
  return { ok: 'Flag added. Re-evaluate to apply it.' }
}

export async function resolveFlag(fd: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) return
  await flagsRepo(await getDb()).resolve(str(fd, 'id'), user.displayName)
  refreshMarkets(str(fd, 'geoId'))
}

export async function addSample(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const db = await getDb()
  const geoId = str(fd, 'geoId')
  const deal = await dealsRepo(db).get(str(fd, 'dealId'))
  if (!deal) return { error: 'Choose a deal from the Deal Analyzer.' }
  const mode = str(fd, 'mode') === 'copy' ? 'assumption' : 'deal'
  const confidence = oneOf(str(fd, 'confidence'), CONFIDENCE_LEVELS) as ConfidenceLevel | null
  if (!confidence || !str(fd, 'source')) return { error: 'Source and evidence strength are required.' }
  const asOf = str(fd, 'asOf') || today()
  await samplesRepo(db).add(
    {
      geoId,
      label: str(fd, 'label') || deal.inputs.address || 'Sample',
      kind: mode,
      dealId: mode === 'deal' ? deal.id : null,
      inputs: mode === 'assumption' ? deal.inputs : null,
      source: str(fd, 'source'),
      sourceUrl: opt(fd, 'sourceUrl'),
      confidence,
      asOf,
    },
    user.displayName,
  )
  refreshMarkets(geoId)
  return { ok: 'Sample added. Re-evaluate to update Capital Efficiency.' }
}

export async function retireSample(fd: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) return
  await samplesRepo(await getDb()).retire(str(fd, 'id'), user.displayName)
  refreshMarkets(str(fd, 'geoId'))
}

export async function promoteGeo(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const geoId = str(fd, 'geoId')
  const r = await promote(await getDb(), geoId, user.displayName)
  refreshMarkets(geoId)
  return r.error ? { error: r.error } : { ok: 'Promoted. You can now add its submarkets / ZIPs; they are analyzed from the next evaluation.' }
}

export async function revokePromotion(fd: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) return
  await promotionsRepo(await getDb()).revoke(str(fd, 'geoId'), user.displayName)
  refreshMarkets(str(fd, 'geoId'))
}

// ---------------------------------------------------------------- avatars

export async function saveAvatar(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const nums = ['bedsMin', 'bedsMax', 'yearBuiltMin', 'yearBuiltMax', 'sqftMin', 'sqftMax', 'purchaseMin', 'purchaseMax', 'arvMin', 'arvMax', 'rentMin', 'rehabMin', 'rehabMax'] as const
  const values: Record<string, number | null> = {}
  const errors: Record<string, string> = {}
  for (const k of nums) {
    const v = numOrNull(fd, k)
    if (v === 'invalid') errors[k] = 'Not a number'
    else values[k] = v
  }
  const a = {
    name: str(fd, 'name'),
    description: str(fd, 'description'),
    propertyTypes: fd.getAll('propertyTypes').map(String).filter((t): t is AvatarPropertyType => t in AVATAR_PROPERTY_TYPES),
    strategies: fd.getAll('strategies').map(String).filter((s): s is StrategyKey => (STRATEGY_KEYS as readonly string[]).includes(s)),
    active: fd.get('active') === 'on',
    ...(values as Record<(typeof nums)[number], number | null>),
  } satisfies Omit<Avatar, 'id'>
  Object.assign(errors, validateAvatar(a))
  if (Object.keys(errors).length) return { error: 'Please fix the highlighted fields.', errors }
  const id = opt(fd, 'id') ?? undefined
  const version = numOrNull(fd, 'version')
  try {
    await avatarsRepo(await getDb()).save({ ...a, id, version: typeof version === 'number' ? version : undefined }, user.displayName)
  } catch (e) {
    if (e instanceof VersionConflictError) return { error: e.message }
    return { error: /unique|duplicate/i.test(String(e)) ? 'An avatar with that name exists.' : String(e) }
  }
  revalidatePath('/markets/avatars')
  redirect('/markets/avatars')
}

// ---------------------------------------------------------------- configuration (admin)

export async function saveMarketConfig(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user || user.role !== 'admin') return { error: 'Only an admin can change scoring configuration.' }
  const next: Record<string, number> = {}
  for (const c of CONFIGURABLE) {
    const v = numOrNull(fd, c.path)
    if (v === 'invalid' || (v !== null && (v < c.min || v > c.max))) return { error: `${c.label}: enter ${c.min}–${c.max}, or leave blank for the default.` }
    if (v !== null) next[c.path] = v
  }
  const n = await configRepo(await getDb()).save(next, user.displayName)
  revalidatePath('/markets/methodology')
  return { ok: n ? `Saved ${n} change${n === 1 ? '' : 's'}. Re-evaluate the markets to apply them.` : 'No changes.' }
}

// ---------------------------------------------------------------- feedback loop (Deal Analyzer side)

export async function saveOutcome(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const db = await getDb()
  const dealId = str(fd, 'dealId')
  const deal = await dealsRepo(db).get(dealId)
  if (!deal) return { error: 'Deal not found.' }
  const errors: Record<string, string> = {}
  const n = (k: string) => {
    const v = numOrNull(fd, k)
    if (v === 'invalid') {
      errors[k] = 'Not a number'
      return null
    }
    return v
  }
  const [link] = await db.query<{ source_candidate_id: string | null }>('select source_candidate_id from deals where id = $1', [dealId])
  const cand = link?.source_candidate_id ? await candidatesRepo(db).get(link.source_candidate_id) : null
  const [snap] = await db.query<{ id: number }>('select id from deal_analysis_snapshots where deal_id = $1 order by created_at desc, id desc limit 1', [dealId])
  const prior = await outcomesRepo(db).get(dealId)
  const input = {
    candidateId: cand?.id ?? null,
    geoId: cand?.geoId ?? null,
    avatarId: cand?.avatarId ?? null,
    predictedSnapshotId: prior?.predictedSnapshotId ?? (snap ? Number(snap.id) : null),
    propertyType: deal.inputs.propertyType,
    purchasePrice: n('purchasePrice'),
    arv: n('arv'),
    rehab: n('rehab'),
    rent: n('rent'),
    timelineMonths: n('timelineMonths'),
    exitStrategy: opt(fd, 'exitStrategy'),
    actualProfit: n('actualProfit'),
    actualAnnualCashFlow: n('actualAnnualCashFlow'),
    actualRefiLoan: n('actualRefiLoan'),
    actualCapitalRecovered: n('actualCapitalRecovered'),
    notes: opt(fd, 'notes'),
  }
  if (Object.keys(errors).length) return { error: 'Please fix the highlighted fields.', errors }
  const v = numOrNull(fd, 'version')
  try {
    await outcomesRepo(db).save(dealId, input, user.displayName, typeof v === 'number' ? v : undefined)
  } catch (e) {
    if (e instanceof VersionConflictError) return { error: e.message }
    throw e
  }
  revalidatePath(`/deals/${dealId}`)
  return { ok: 'Actual result saved (kept next to the analysis that was predicted).' }
}
