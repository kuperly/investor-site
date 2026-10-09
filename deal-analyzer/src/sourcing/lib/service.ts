/**
 * Deal Sourcing orchestration (layers 3–4) and the gates to the layers around it:
 *   ↑ reads Market Intelligence decisions (never re-scores markets)
 *   ↓ hands leads to the Deal Analyzer through the DealInputs contract (never underwrites)
 */
import { analyzeDeal } from '@/engine/analyze'
import { applyDefaults, emptyInputs } from '@/engine/fields'
import { compSummaryFor } from '@/lib/comp-summary'
import type { Db } from '@/lib/db'
import { snapshotDeal } from '@/lib/deal-snapshots'
import { dealsRepo } from '@/lib/deals-repo'
import { settingsRepo } from '@/lib/settings-repo'
import type { Geography } from '@/market/engine/types'
import { audit, avatarsRepo, geoRepo, outcomesRepo, snapshotsRepo, VersionConflictError } from '@/market/lib/repo'
import { buildFunnel, type FunnelLead, type FunnelRow } from '../engine/funnel'
import { handoffGate, leadGate, targetGate } from '../engine/gates'
import { candidateToDeal } from '../engine/handoff'
import { addressKey, parseLeadsCsv, type LeadInput } from '../engine/leads'
import { screenBuyBox } from '../engine/screen'
import { candidatesRepo, targetsRepo, type CandidateRow, type TargetRow } from './repo'

export interface Result<T = object> {
  error?: string
  ok?: T
}

/** The market layer's latest word on a geography (from its stored snapshot). */
export async function latestDecision(db: Db, geoId: string) {
  const [s] = await snapshotsRepo(db).history(geoId, 1)
  return s ? { decision: s.result.decision.state, blocked: s.result.priority.blocked, at: s.createdAt } : null
}

/** Layer 2 → 3. */
export async function openTarget(
  db: Db,
  t: { geoId: string; avatarId: string | null; reason: string | null; notes: string | null },
  by: string,
): Promise<Result<{ id: string }>> {
  const geo = await geoRepo(db).get(t.geoId)
  if (!geo) return { error: 'Geography not found.' }
  if (t.avatarId && !(await avatarsRepo(db).get(t.avatarId))) return { error: 'Avatar not found.' }
  const latest = await latestDecision(db, t.geoId)
  const gate = targetGate(latest)
  if (!gate.allowed) return { error: gate.message }
  const reason = t.reason?.trim() || null
  if (gate.needsReason && !reason) return { error: gate.message }
  try {
    const id = await targetsRepo(db).create({ geoId: t.geoId, avatarId: t.avatarId, gateDecision: latest!.decision, overrideReason: reason, notes: t.notes }, by)
    return { ok: { id } }
  } catch (e) {
    if (/unique|duplicate/i.test(String(e))) return { error: 'There is already an open target for this geography and avatar.' }
    throw e
  }
}

async function prepareLead(db: Db, target: TargetRow, lead: LeadInput) {
  const avatar = target.avatarId ? await avatarsRepo(db).get(target.avatarId) : null
  const geo = await geoRepo(db).get(target.geoId)
  const zip = lead.zip ?? (geo?.level === 'zcta' ? geo.code : null)
  return {
    row: { ...lead, zip, state: lead.state ?? geo?.state ?? null, geoId: target.geoId, avatarId: target.avatarId, targetId: target.id, addressKey: addressKey(lead.address, zip) },
    screening: screenBuyBox(lead, avatar),
  }
}

/** Layer 3 → 4: one lead under an active target. Duplicates are refused. */
export async function addLead(db: Db, targetId: string, lead: LeadInput, by: string): Promise<Result<{ id: string }>> {
  const target = await targetsRepo(db).get(targetId)
  const gate = leadGate(target?.status ?? null)
  if (!gate.allowed || !target) return { error: gate.message }
  const { row, screening } = await prepareLead(db, target, lead)
  const dup = await candidatesRepo(db).findOpenByKey(row.addressKey)
  if (dup) return { error: `Already in the pipeline: ${dup.address} (${dup.status.replace('_', ' ')}).` }
  return { ok: { id: await candidatesRepo(db).create(row, screening, by) } }
}

export interface ImportSummary {
  added: number
  duplicates: { line: number; address: string }[]
  invalid: { line: number; errors: string[] }[]
}

/** Bulk intake from a CSV list. Valid, new rows are added in one transaction. */
export async function importLeads(db: Db, targetId: string, csv: string, fallbackSource: string, by: string): Promise<Result<ImportSummary>> {
  const target = await targetsRepo(db).get(targetId)
  const gate = leadGate(target?.status ?? null)
  if (!gate.allowed || !target) return { error: gate.message }
  const parsed = parseLeadsCsv(csv, fallbackSource)
  if (parsed.error) return { error: parsed.error }
  const summary: ImportSummary = { added: 0, duplicates: [], invalid: [] }
  await db.transaction(async (tx) => {
    const seen = new Set<string>()
    for (const r of parsed.rows) {
      if (!r.lead) {
        summary.invalid.push({ line: r.line, errors: Object.entries(r.errors).map(([k, v]) => `${k}: ${v}`) })
        continue
      }
      const { row, screening } = await prepareLead(tx, target, r.lead)
      if (seen.has(row.addressKey) || (await candidatesRepo(tx).findOpenByKey(row.addressKey))) {
        summary.duplicates.push({ line: r.line, address: r.lead.address })
        continue
      }
      seen.add(row.addressKey)
      await candidatesRepo(tx).create(row, screening, by)
      summary.added++
    }
    await audit(tx, 'target', target.id, 'import', null, { added: summary.added, duplicates: summary.duplicates.length, invalid: summary.invalid.length }, by)
  })
  return { ok: summary }
}

/** Re-run the buy-box screen (e.g. after the avatar changed). */
export async function rescreen(db: Db, candidateId: string, by: string): Promise<void> {
  const c = await candidatesRepo(db).get(candidateId)
  if (!c || c.status !== 'new') return
  const avatar = c.avatarId ? await avatarsRepo(db).get(c.avatarId) : null
  await candidatesRepo(db).setScreening(c.id, screenBuyBox(c, avatar), by)
}

/** Layer 4 → 5: lead → new Deal Analyzer deal, in one transaction. */
export async function handOff(db: Db, candidateId: string, expectedVersion: number, by: string, reason: string | null = null): Promise<{ dealId?: string; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      const c = await candidatesRepo(tx).get(candidateId)
      if (!c) return { error: 'Lead not found.' }
      if (c.status === 'handed_off' && c.dealId) return { dealId: c.dealId }
      if (c.status === 'rejected') return { error: 'This lead was rejected.' }
      const gate = handoffGate(c.screening?.overall ?? null)
      const why = reason?.trim() || null
      if (gate.needsReason && !why) return { error: gate.message }
      const geo = await geoRepo(tx).get(c.geoId)
      const avatar = c.avatarId ? await avatarsRepo(tx).get(c.avatarId) : null
      const { inputs, note } = candidateToDeal({ ...c, geoName: geo?.name ?? c.geoId, avatarName: avatar?.name ?? null })
      const { inputs: withDefaults, filled: defaulted } = applyDefaults({ ...emptyInputs(), ...inputs }, await settingsRepo(tx).getDefaults())
      const dealInputs = { ...withDefaults, ...(await compSummaryFor(tx, null)) }
      const fullNote = gate.needsReason ? `${note}\nSent despite a failed buy-box screen: ${why}` : note
      const dealId = await dealsRepo(tx).create(dealInputs, { general: fullNote }, 'Lead', by, defaulted)
      await tx.query('update deals set source_candidate_id = $2 where id = $1', [dealId, c.id])
      await candidatesRepo(tx).setStatus(c.id, 'handed_off', expectedVersion, by, { dealId, overrideReason: gate.needsReason ? why : null })
      await snapshotDeal(tx, dealId, by)
      return { dealId }
    })
  } catch (e) {
    if (e instanceof VersionConflictError) return { error: e.message }
    throw e
  }
}

// ---------------------------------------------------------------- pipeline view

function msaOf(id: string, byId: Map<string, Geography>): Geography | null {
  let g = byId.get(id)
  while (g && g.level !== 'msa') g = g.parentId ? byId.get(g.parentId) : undefined
  return g ?? null
}

export interface PipelineView {
  rows: (FunnelRow & { market: Geography | null; decision: string | null })[]
  targets: (TargetRow & { geo: Geography | null; avatarName: string | null; leads: number; open: number })[]
}

/** Counts per market across the layers, plus every target with its lead counts. */
export async function pipeline(db: Db): Promise<PipelineView> {
  const [geos, targets, leads, avatars, snaps] = await Promise.all([
    geoRepo(db).list(),
    targetsRepo(db).list(),
    candidatesRepo(db).list(),
    avatarsRepo(db).list(),
    snapshotsRepo(db).latestTwo(),
  ])
  const byId = new Map(geos.map((g) => [g.id, g]))
  const market = (geoId: string) => msaOf(geoId, byId)?.id ?? geoId
  const deals = dealsRepo(db)
  const outcomes = outcomesRepo(db)
  const funnelLeads: FunnelLead[] = []
  for (const l of leads) {
    let deal: FunnelLead['deal'] = null
    if (l.status === 'handed_off' && l.dealId) {
      const d = await deals.get(l.dealId)
      if (d)
        deal = {
          status: d.status,
          recommendation: analyzeDeal(d.inputs).recommendation.recommendation,
          hasOutcome: (await outcomes.get(d.id)) !== null,
        }
    }
    funnelLeads.push({ marketId: market(l.geoId), targetId: l.targetId, status: l.status, screen: l.screening?.overall ?? null, deal })
  }
  const rows = buildFunnel(targets.map((t) => ({ marketId: market(t.geoId), status: t.status })), funnelLeads).map((r) => ({
    ...r,
    market: byId.get(r.marketId) ?? null,
    decision: snaps.get(r.marketId)?.latest.decision ?? null,
  }))
  const avatarName = new Map(avatars.map((a) => [a.id, a.name]))
  return {
    rows,
    targets: targets.map((t) => ({
      ...t,
      geo: byId.get(t.geoId) ?? null,
      avatarName: t.avatarId ? (avatarName.get(t.avatarId) ?? null) : null,
      leads: leads.filter((l) => l.targetId === t.id).length,
      open: leads.filter((l) => l.targetId === t.id && l.status === 'new').length,
    })),
  }
}

export type { CandidateRow, TargetRow }
