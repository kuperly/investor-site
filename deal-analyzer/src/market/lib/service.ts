/**
 * VF-03 orchestration: loads evidence, runs the engine, stores snapshots, promotes for
 * drill-down and hands candidates to the Deal Analyzer. The scoring itself is in ../engine.
 */
import { applyDefaults, emptyInputs } from '@/engine/fields'
import type { DealInputs } from '@/engine/types'
import { compSummaryFor } from '@/lib/comp-summary'
import type { Db } from '@/lib/db'
import { snapshotDeal } from '@/lib/deal-snapshots'
import { dealsRepo } from '@/lib/deals-repo'
import { settingsRepo } from '@/lib/settings-repo'
import type { SampleInput } from '../engine/capital'
import { explainChange, type ChangeExplanation } from '../engine/change'
import { resolveConfig, type MarketConfig } from '../engine/config'
import { evaluateMarkets, type GeoInput, type MarketEvaluation } from '../engine/evaluate'
import { candidateToDeal } from '../engine/handoff'
import type { Geography } from '../engine/types'
import {
  audit,
  avatarsRepo,
  candidatesRepo,
  configRepo,
  flagsRepo,
  geoRepo,
  observationsRepo,
  promotionsRepo,
  samplesRepo,
  snapshotsRepo,
  VersionConflictError,
  type SnapshotRow,
} from './repo'

export async function currentConfig(db: Db): Promise<{ config: MarketConfig; overrides: Record<string, number>; rejected: string[] }> {
  const overrides = await configRepo(db).overrides()
  return { ...resolveConfig(overrides), overrides }
}

/** Nearest MSA ancestor (or self). */
function msaOf(g: Geography, byId: Map<string, Geography>): Geography | null {
  let cur: Geography | undefined = g
  while (cur && cur.level !== 'msa') cur = cur.parentId ? byId.get(cur.parentId) : undefined
  return cur ?? null
}

/**
 * Conditional drill-down (§17): a geography below MSA level is analyzed only when its parent is
 * promoted. A submarket has no official data of its own in V1, so its ZIPs follow the MSA's
 * promotion when the submarket itself is not promoted.
 */
export function analyzable(g: Geography, byId: Map<string, Geography>, promoted: Set<string>): boolean {
  if (g.level === 'country' || g.level === 'msa') return true
  const parent = g.parentId ? byId.get(g.parentId) : undefined
  if (!parent) return false
  if (promoted.has(parent.id)) return analyzable(parent, byId, promoted)
  if (parent.level === 'submarket' && parent.parentId && promoted.has(parent.parentId)) return analyzable(parent, byId, promoted)
  return false
}

export async function canAddChild(db: Db, parentId: string): Promise<boolean> {
  const geos = await geoRepo(db).list()
  const byId = new Map(geos.map((g) => [g.id, g]))
  const parent = byId.get(parentId)
  if (!parent) return false
  const promoted = new Set((await promotionsRepo(db).active()).keys())
  if (!analyzable(parent, byId, promoted)) return false
  return promoted.has(parentId) || (parent.level === 'submarket' && Boolean(parent.parentId && promoted.has(parent.parentId)))
}

async function sampleInputs(db: Db, geoIds: string[]): Promise<Map<string, SampleInput[]>> {
  const rows = await samplesRepo(db).active(geoIds)
  const deals = dealsRepo(db)
  const out = new Map<string, SampleInput[]>()
  for (const s of rows) {
    let inputs: DealInputs | null = null
    if (s.kind === 'deal' && s.dealId) inputs = (await deals.get(s.dealId))?.inputs ?? null
    else if (s.inputs) inputs = { ...emptyInputs(), ...s.inputs }
    if (!inputs) continue
    out.set(s.geoId, [...(out.get(s.geoId) ?? []), { id: s.id, label: s.label, kind: s.kind, confidence: s.confidence, source: s.source, asOf: s.asOf, inputs }])
  }
  return out
}

export interface EvaluationRun {
  batchId: string
  evaluations: MarketEvaluation[]
  skipped: { geo: Geography; reason: string }[]
}

/** Evaluates every analyzable geography (peer groups need each other) and stores a snapshot batch. */
export async function evaluateAll(db: Db, by: string, evaluationDate: string): Promise<EvaluationRun> {
  const geos = await geoRepo(db).list()
  const byId = new Map(geos.map((g) => [g.id, g]))
  const promotions = await promotionsRepo(db).active()
  const promoted = new Set(promotions.keys())
  const included = geos.filter((g) => analyzable(g, byId, promoted))
  const skipped = geos.filter((g) => !included.includes(g)).map((geo) => ({ geo, reason: 'Parent not promoted for drill-down' }))
  const ids = included.map((g) => g.id)
  const [obs, flags, samples] = await Promise.all([observationsRepo(db).accepted(ids), flagsRepo(db).active(ids), sampleInputs(db, ids)])
  const inputs: GeoInput[] = included.map((g) => ({
    geo: g,
    observations: obs.filter((o) => o.geoId === g.id),
    samples: samples.get(g.id) ?? [],
    hardFlags: flags.filter((f) => f.geoId === g.id),
    promoted: promoted.has(g.id),
    // ZIPs (and deeper) compete with the other ZIPs of the same market.
    peerGroup: g.level === 'msa' || g.level === 'country' ? undefined : `${g.level}@${msaOf(g, byId)?.id ?? g.parentId}`,
  }))
  const { config } = await currentConfig(db)
  const evaluations = evaluateMarkets(inputs, config, evaluationDate)
  const batchId = evaluations.length ? await snapshotsRepo(db).insertBatch(evaluations, config, by) : ''
  return { batchId, evaluations, skipped }
}

export interface MarketRow {
  geo: Geography
  latest: SnapshotRow | null
  change: ChangeExplanation | null
  analyzable: boolean
  promoted: boolean
}

export async function marketRows(db: Db): Promise<MarketRow[]> {
  const [geos, snaps, promotions, { config }] = await Promise.all([geoRepo(db).list(), snapshotsRepo(db).latestTwo(), promotionsRepo(db).active(), currentConfig(db)])
  const byId = new Map(geos.map((g) => [g.id, g]))
  const promoted = new Set(promotions.keys())
  return geos.map((geo) => {
    const s = snaps.get(geo.id)
    return {
      geo,
      latest: s?.latest ?? null,
      change: s?.latest && s.previous ? explainChange(s.previous.result, s.latest.result, config) : null,
      analyzable: analyzable(geo, byId, promoted),
      promoted: promoted.has(geo.id),
    }
  })
}

/** Promotes a geography for drill-down — only if its latest snapshot says it qualifies. Stores why. */
export async function promote(db: Db, geoId: string, by: string): Promise<{ error?: string }> {
  const [latest] = await snapshotsRepo(db).history(geoId, 1)
  if (!latest) return { error: 'Evaluate the markets first.' }
  const e = latest.result
  if (e.drillDown.state !== 'eligible') return { error: `Not eligible for drill-down: ${e.drillDown.checks.filter((c) => c.pass !== true).map((c) => `${c.label} (${c.detail})`).join('; ') || 'not a drillable level'}` }
  await promotionsRepo(db).promote(
    geoId,
    latest.id,
    { checks: e.drillDown.checks, decision: e.decision.state, priority: e.priority.point, note: e.decision.reasons.join(' | ') },
    by,
  )
  return {}
}

/** Candidate → new Deal Analyzer deal, in one transaction. Returns the deal id. */
export async function handOff(db: Db, candidateId: string, expectedVersion: number, by: string): Promise<{ dealId?: string; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      const c = await candidatesRepo(tx).get(candidateId)
      if (!c) return { error: 'Candidate not found.' }
      if (c.status === 'handed_off' && c.dealId) return { dealId: c.dealId }
      const geo = await geoRepo(tx).get(c.geoId)
      const avatar = c.avatarId ? await avatarsRepo(tx).get(c.avatarId) : null
      const { inputs, note } = candidateToDeal({ ...c, geoName: geo?.name ?? c.geoId, avatarName: avatar?.name ?? null })
      const { inputs: withDefaults, filled: defaulted } = applyDefaults({ ...emptyInputs(), ...inputs }, await settingsRepo(tx).getDefaults())
      const deals = dealsRepo(tx)
      const dealInputs = { ...withDefaults, ...(await compSummaryFor(tx, null)) }
      const dealId = await deals.create(dealInputs, { general: note }, 'Lead', by, defaulted)
      await tx.query('update deals set source_candidate_id = $2 where id = $1', [dealId, c.id])
      await candidatesRepo(tx).setStatus(c.id, 'handed_off', expectedVersion, by, dealId)
      await audit(tx, 'candidate', c.id, 'handed_off', null, { dealId }, by)
      await snapshotDeal(tx, dealId, by)
      return { dealId }
    })
  } catch (e) {
    if (e instanceof VersionConflictError) return { error: e.message }
    throw e
  }
}
