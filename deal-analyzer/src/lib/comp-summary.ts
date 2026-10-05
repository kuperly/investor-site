/** Keeps a deal's §8 comp summary fields in sync with its comps list (audited via deals-repo). */
import { compStats, summaryFromComps, type CompSummaryKey } from '@/engine/comps'
import type { DealInputs, Num } from '@/engine/types'
import { compsRepo } from './comps-repo'
import type { Db } from './db'
import { dealsRepo } from './deals-repo'
import { money, num } from './format'
import type { User } from './users'

export async function compSummaryFor(db: Db, dealId: string | null): Promise<Pick<DealInputs, CompSummaryKey>> {
  const comps = dealId ? await compsRepo(db).list(dealId) : []
  return summaryFromComps(compStats(comps, new Date()))
}

/** Recomputes the summary from the list and writes any changed fields (one audit row each). */
export async function syncCompSummary(db: Db, dealId: string, user: User): Promise<number> {
  const deals = dealsRepo(db)
  const deal = await deals.get(dealId)
  if (!deal) return 0
  const summary = await compSummaryFor(db, dealId)
  return deals.update(dealId, { inputs: { ...deal.inputs, ...summary } }, user)
}

const mi = (v: Num) => (v === null ? 'UNKNOWN' : `${num(v, 2)} mi`)
const mo = (v: Num) => (v === null ? 'UNKNOWN' : `${num(v, 1)} months`)

export function formatCompSummary(s: Pick<DealInputs, CompSummaryKey>): Record<CompSummaryKey, string> {
  return {
    compCount: num(s.compCount),
    compAvgPrice: money(s.compAvgPrice),
    compMedianPrice: money(s.compMedianPrice),
    compDistanceMiles: mi(s.compDistanceMiles),
    compRecencyMonths: mo(s.compRecencyMonths),
    compRenovatedCount: num(s.compRenovatedCount),
    compUnrenovatedCount: num(s.compUnrenovatedCount),
  }
}
