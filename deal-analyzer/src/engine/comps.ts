/**
 * §32 Comparable properties — pure statistics over a comp list.
 * Statistics + the comp-supported ARV suggestion (compArv, below). The engine never
 * writes ARV: Base ARV changes only when the user applies the suggestion (audited).
 * Unknown values are skipped per statistic (and counted), never treated as 0.
 */
import { PROVISIONAL } from './config'
import type { DealInputs, Num } from './types'

export const RENOVATIONS = ['renovated', 'unrenovated'] as const
export type Renovation = (typeof RENOVATIONS)[number] | null

/** User-assigned importance on top of the computed weight. */
export const COMP_TIERS = ['standard', 'bestFit', 'superComp'] as const
export type CompTier = (typeof COMP_TIERS)[number]
export const TIER_LABELS: Record<CompTier, string> = { standard: 'Standard', bestFit: 'Best fit', superComp: 'Super comp' }

export const SALE_STATUSES = ['sold', 'pending', 'active'] as const
export type SaleStatus = (typeof SALE_STATUSES)[number] | null

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
  saleStatus: SaleStatus
  tier: CompTier
  /**
   * Fixed share of the comp ARV (0–1), Super comps only. null = use the computed weight.
   * The rest of the share is split among the other used comps by their weights.
   */
  shareOverride: Num
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

// ─── Comp-supported ARV ──────────────────────────────────────────────────────
// Approved method: weighted average $/sqft of included renovated comps × subject sqft.
// Weights (time, distance, similarity, tier) are PROVISIONAL — see config.ts.

const W = PROVISIONAL.compArv

/** Linear from 1 (x = 0) down to `floor` (x ≥ floorAt). Unknown x → floor (least similar). */
export function decayFactor(x: Num, floorAt: number, floor: number = W.floor): number {
  if (x === null) return floor
  const t = Math.min(Math.abs(x) / floorAt, 1)
  return 1 - (1 - floor) * t
}

export interface SubjectFacts {
  sqft: Num
  beds: Num
  baths: Num
}

export interface CompWeight {
  recency: number
  distance: number
  similarity: number
  /** Sub-scores averaged into `similarity`; null = skipped (subject value unknown). */
  similarityParts: { sqft: number | null; beds: number | null; baths: number | null; status: number }
  tier: number
  /** Raw weight = tier × recency × distance × similarity. */
  weight: number
  /** Comp inputs that were UNKNOWN and therefore scored at the floor. */
  unknowns: string[]
}

export function compWeight(c: Comp, subject: SubjectFacts, asOf: Date): CompWeight {
  const unknowns: string[] = []
  const note = (label: string, v: unknown) => {
    if (v === null || v === undefined) unknowns.push(label)
  }
  const age = monthsSince(c.saleDate, asOf)
  note('sale date', age)
  note('distance', c.distanceMiles)
  const recency = decayFactor(age, W.recency.floorAtMonths)
  const distance = decayFactor(c.distanceMiles, W.distance.floorAtMiles)

  const S = W.similarity
  const part = (subj: Num, comp: Num, label: string, f: (s: number, c: number) => number): number | null => {
    if (subj === null) return null // subject unknown: same for every comp → skip
    if (comp === null) {
      unknowns.push(label)
      return W.floor
    }
    return f(subj, comp)
  }
  const sqft = part(subject.sqft, c.sqft, 'sqft', (s, v) =>
    s > 0 ? decayFactor((v - s) / s, S.sqftFloorAtPct) : W.floor,
  )
  const beds = part(subject.beds, c.beds, 'beds', (s, v) => decayFactor(v - s, S.bedsFloorAtDiff))
  const baths = part(subject.baths, c.baths, 'baths', (s, v) => decayFactor(v - s, S.bathsFloorAtDiff))
  note('status', c.saleStatus)
  const status = c.saleStatus === null ? W.floor : S.status[c.saleStatus]
  const parts = [sqft, beds, baths, status].filter((x): x is number => x !== null)
  const similarity = parts.reduce((a, b) => a + b, 0) / parts.length

  const tier = W.tiers[c.tier]
  return {
    recency,
    distance,
    similarity,
    similarityParts: { sqft, beds, baths, status },
    tier,
    weight: tier * recency * distance * similarity,
    unknowns,
  }
}

export type CompArvExclusion =
  | 'excluded by user'
  | 'not marked renovated'
  | 'no sale price'
  | 'no sqft'

export interface CompArvResult<T extends Comp> {
  /** Suggested Base ARV; null = UNKNOWN (no usable comps, subject sqft unknown, or overrides > 100%). */
  arv: Num
  /** Problems with % overrides, shown to the user. */
  issues: string[]
  subjectSqft: Num
  weightedPpsf: Num
  /** Cross-check: unweighted median $/sqft × subject sqft. */
  medianPpsfArv: Num
  used: { comp: T; ppsf: number; w: CompWeight; share: number; overridden: boolean }[]
  excluded: { comp: T; reason: CompArvExclusion }[]
}

export function compArv<T extends Comp>(comps: T[], subject: SubjectFacts, asOf: Date): CompArvResult<T> {
  const excluded: CompArvResult<T>['excluded'] = []
  const candidates: { comp: T; ppsf: number; w: CompWeight }[] = []
  for (const comp of comps) {
    const reason: CompArvExclusion | null = !comp.included
      ? 'excluded by user'
      : comp.renovation !== 'renovated'
        ? 'not marked renovated'
        : comp.salePrice === null
          ? 'no sale price'
          : comp.sqft === null || comp.sqft <= 0
            ? 'no sqft'
            : null
    if (reason) {
      excluded.push({ comp, reason })
      continue
    }
    candidates.push({ comp, ppsf: pricePerSqft(comp.salePrice, comp.sqft)!, w: compWeight(comp, subject, asOf) })
  }
  const issues: string[] = []
  for (const e of excluded) {
    if (e.comp.shareOverride !== null) issues.push(`% override on ${e.comp.address} not applied — comp not used (${e.reason})`)
  }
  // Fixed shares (Super comps only — anything else is ignored and reported).
  const isFixed = (c: Comp) => c.shareOverride !== null && c.tier === 'superComp'
  for (const c of candidates) {
    if (c.comp.shareOverride !== null && c.comp.tier !== 'superComp')
      issues.push(`% override on ${c.comp.address} ignored — only Super comps can have one`)
  }
  const fixed = candidates.filter((c) => isFixed(c.comp))
  const free = candidates.filter((c) => !isFixed(c.comp))
  let fixedTotal = fixed.reduce((a, c) => a + c.comp.shareOverride!, 0)
  const freeWeight = free.reduce((a, c) => a + c.w.weight, 0)
  let invalid = false
  if (fixedTotal > 1 + 1e-9) {
    issues.push(`% overrides total ${(fixedTotal * 100).toFixed(1)}% — must be 100% or less. Comp ARV is UNKNOWN until fixed.`)
    invalid = true
  } else if (fixed.length > 0 && fixedTotal < 1 - 1e-9 && freeWeight === 0) {
    issues.push(
      `% overrides total ${(fixedTotal * 100).toFixed(1)}% and no other comp can take the remaining ${((1 - fixedTotal) * 100).toFixed(1)}% — overrides scaled up to 100%.`,
    )
  }
  const scale = fixed.length > 0 && freeWeight === 0 && fixedTotal > 0 && !invalid ? 1 / fixedTotal : 1
  if (scale !== 1) fixedTotal = 1
  const remaining = Math.max(0, 1 - fixedTotal)
  const used = candidates.map((c) => {
    const overridden = isFixed(c.comp)
    const share = overridden
      ? c.comp.shareOverride! * scale
      : freeWeight > 0
        ? (c.w.weight / freeWeight) * remaining
        : 0
    return { ...c, share, overridden }
  })
  const shareSum = used.reduce((a, c) => a + c.share, 0)
  const weightedPpsf = invalid || shareSum <= 0 ? null : used.reduce((a, c) => a + c.ppsf * c.share, 0) / shareSum
  const medPpsf = median(used.map((c) => c.ppsf))
  const sqft = subject.sqft !== null && subject.sqft > 0 ? subject.sqft : null
  return {
    arv: weightedPpsf === null || sqft === null ? null : Math.round(weightedPpsf * sqft),
    subjectSqft: subject.sqft,
    weightedPpsf,
    medianPpsfArv: medPpsf === null || sqft === null ? null : Math.round(medPpsf * sqft),
    issues,
    used,
    excluded,
  }
}
