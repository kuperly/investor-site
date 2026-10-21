/**
 * Stored analysis snapshots (VF-03 §2.5). The live deal page always recomputes; a snapshot
 * keeps what the engine said at the time of each save, so later rule changes never rewrite
 * history and actual results can be compared with what was predicted (feedback loop, §20).
 */
import { analyzeDeal, type DealAnalysis } from '@/engine/analyze'
import { compArv } from '@/engine/comps'
import { ENGINE_VERSION } from '@/engine/config'
import type { Num, Ratio, Recommendation } from '@/engine/types'
import { compsRepo } from './comps-repo'
import type { Db } from './db'
import { dealsRepo } from './deals-repo'
import type { User } from './users'

export interface AnalysisSummary {
  score: number
  maxAchievable: number
  complete: boolean
  recommendation: Recommendation
  allIn: Num
  arvBase: Num
  equity: Num
  capitalRecycledPct: Num
  cashLeftInDeal: Num
  dscr: Num
  monthlyCashFlow: Num
  cashOnCash: Ratio
  flipNetProfit: Num
  maxOfferBase: Num
  viableStrategies: string[]
}

export function summarize(a: DealAnalysis): AnalysisSummary {
  const s = a.strategies
  return {
    score: a.score.total,
    maxAchievable: a.score.maxAchievable,
    complete: a.score.complete,
    recommendation: a.recommendation.recommendation,
    allIn: a.base.totalProjectCost,
    arvBase: a.base.arv,
    equity: a.base.equityCreated,
    capitalRecycledPct: a.base.refi.capitalRecycledPct,
    cashLeftInDeal: a.base.refi.cashLeftInDeal,
    dscr: a.base.refi.dscr,
    monthlyCashFlow: a.base.refi.monthlyCashFlow,
    cashOnCash: a.base.refi.cashOnCash,
    flipNetProfit: a.base.flip.netProfit,
    maxOfferBase: a.arvScenarios.find((x) => x.key === 'arvBase')?.maxOffer.maxPurchasePrice ?? null,
    viableStrategies: [s.brrrr, s.hold, s.flip, s.hybrid].filter((x) => x.viable === true).map((x) => x.strategy),
  }
}

export interface AnalysisSnapshot {
  id: number
  dealVersion: number
  engineVersion: string
  summary: AnalysisSummary
  createdBy: string
  createdAt: Date
}

/** Analyzes the deal as currently stored and records the result. Call inside the save transaction. */
export async function snapshotDeal(db: Db, dealId: string, user: User, asOf = new Date()): Promise<void> {
  const deal = await dealsRepo(db).get(dealId)
  if (!deal) return
  const comps = await compsRepo(db).list(dealId)
  const arv = compArv(comps, { sqft: deal.inputs.sqft, beds: deal.inputs.beds, baths: deal.inputs.baths }, asOf).arv
  const analysis = analyzeDeal(deal.inputs, { compArv: arv })
  await db.query(
    `insert into deal_analysis_snapshots (deal_id, deal_version, engine_version, inputs, comp_arv, result, full_result, created_by)
     values ($1,$2,$3,$4::text::jsonb,$5,$6::text::jsonb,$7::text::jsonb,$8)`,
    [dealId, deal.version, ENGINE_VERSION, JSON.stringify(deal.inputs), arv, JSON.stringify(summarize(analysis)), JSON.stringify(analysis), user],
  )
}

export async function listSnapshots(db: Db, dealId: string, limit = 20): Promise<AnalysisSnapshot[]> {
  const rows = await db.query<Record<string, unknown>>(
    `select id, deal_version, engine_version, result, created_by, created_at from deal_analysis_snapshots
     where deal_id = $1 order by created_at desc, id desc limit $2`,
    [dealId, limit],
  )
  return rows.map((r) => ({
    id: Number(r.id),
    dealVersion: Number(r.deal_version),
    engineVersion: r.engine_version as string,
    summary: (typeof r.result === 'string' ? JSON.parse(r.result) : r.result) as AnalysisSummary,
    createdBy: r.created_by as string,
    createdAt: new Date(r.created_at as string),
  }))
}

export async function latestSnapshotId(db: Db, dealId: string): Promise<number | null> {
  const [r] = await db.query<{ id: number }>(
    'select id from deal_analysis_snapshots where deal_id = $1 order by created_at desc, id desc limit 1',
    [dealId],
  )
  return r ? Number(r.id) : null
}
