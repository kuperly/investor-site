/**
 * §32 Comparable properties — pure statistics over a comp list.
 * No valuation rules: the engine summarises comps, it never sets ARV.
 * Unknown values are skipped per statistic (and counted), never treated as 0.
 */
import type { DealInputs, Num } from './types'

export const RENOVATIONS = ['renovated', 'unrenovated'] as const
export type Renovation = (typeof RENOVATIONS)[number] | null

export interface Comp {
  address: string
  salePrice: Num
  /** YYYY-MM-DD */
  saleDate: string | null
  sqft: Num
  beds: Num
  baths: Num
  distanceMiles: Num
  condition: string | null
  renovation: Renovation
  source: string | null
  sourceUrl: string | null
  notes: string | null
  included: boolean
}

export function pricePerSqft(salePrice: Num, sqft: Num): Num {
  if (salePrice === null || sqft === null || sqft <= 0) return null
  return salePrice / sqft
}

const MS_PER_MONTH = (365.25 / 12) * 24 * 60 * 60 * 1000

/** Age of a sale in months (1 decimal) as of a given date; null if the date is unknown/invalid. */
export function monthsSince(saleDate: string | null, asOf: Date): Num {
  if (!saleDate) return null
  const t = Date.parse(`${saleDate}T00:00:00Z`)
  if (Number.isNaN(t)) return null
  return Math.round(((asOf.getTime() - t) / MS_PER_MONTH) * 10) / 10
}

export function mean(xs: number[]): Num {
  return xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length
}

export function median(xs: number[]): Num {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const known = (xs: Num[]): number[] => xs.filter((x): x is number => x !== null)

export interface CompGroupStats {
  count: number
  /** How many comps had a sale price (the price stats use only these). */
  withPrice: number
  withPpsf: number
  avgPrice: Num
  medianPrice: Num
  minPrice: Num
  maxPrice: Num
  avgPpsf: Num
  medianPpsf: Num
  avgDistance: Num
  maxDistance: Num
  newestMonths: Num
  oldestMonths: Num
}

export function compGroupStats(comps: Comp[], asOf: Date): CompGroupStats {
  const prices = known(comps.map((c) => c.salePrice))
  const ppsf = known(comps.map((c) => pricePerSqft(c.salePrice, c.sqft)))
  const dist = known(comps.map((c) => c.distanceMiles))
  const ages = known(comps.map((c) => monthsSince(c.saleDate, asOf)))
  return {
    count: comps.length,
    withPrice: prices.length,
    withPpsf: ppsf.length,
    avgPrice: mean(prices),
    medianPrice: median(prices),
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    avgPpsf: mean(ppsf),
    medianPpsf: median(ppsf),
    avgDistance: mean(dist),
    maxDistance: dist.length ? Math.max(...dist) : null,
    newestMonths: ages.length ? Math.min(...ages) : null,
    oldestMonths: ages.length ? Math.max(...ages) : null,
  }
}

export interface CompStats {
  all: CompGroupStats
  renovated: CompGroupStats
  unrenovated: CompGroupStats
  /** Included comps not yet marked renovated/unrenovated. */
  unclassified: number
  /** Comps on file but excluded from stats by the user. */
  excluded: number
}

/** Stats over the comps the user has marked as included. */
export function compStats(comps: Comp[], asOf: Date): CompStats {
  const inc = comps.filter((c) => c.included)
  return {
    all: compGroupStats(inc, asOf),
    renovated: compGroupStats(inc.filter((c) => c.renovation === 'renovated'), asOf),
    unrenovated: compGroupStats(inc.filter((c) => c.renovation === 'unrenovated'), asOf),
    unclassified: inc.filter((c) => c.renovation === null).length,
    excluded: comps.length - inc.length,
  }
}

export type CompSummaryKey =
  | 'compCount'
  | 'compAvgPrice'
  | 'compMedianPrice'
  | 'compDistanceMiles'
  | 'compRecencyMonths'
  | 'compRenovatedCount'
  | 'compUnrenovatedCount'

/**
 * Values for the deal's §8 comp summary fields, derived from the list.
 * Distance = farthest comp, recency = oldest sale ("all comps within X mi / Y months").
 * Applied to the deal only when the user clicks "Apply" (audited) — never automatically.
 */
export function summaryFromComps(s: CompStats): Pick<DealInputs, CompSummaryKey> {
  const round = (x: Num, d = 0) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d)
  return {
    compCount: s.all.count,
    compAvgPrice: round(s.all.avgPrice),
    compMedianPrice: round(s.all.medianPrice),
    compDistanceMiles: round(s.all.maxDistance, 2),
    compRecencyMonths: round(s.all.oldestMonths, 1),
    compRenovatedCount: s.renovated.count,
    compUnrenovatedCount: s.unrenovated.count,
  }
}
