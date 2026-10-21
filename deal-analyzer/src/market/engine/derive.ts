/**
 * From a geography's stored observations (full history) to the current evidence per metric:
 * picks the latest accepted value of each raw metric, adjusts ACS confidence for its margin of
 * error, and computes the derived metrics (ratios, growth, volatility) with their methodology.
 * A derived value exists only when every input exists — never filled with 0.
 */
import { METRICS } from './metrics'
import { CONFIDENCE_LEVELS, type ConfidenceLevel, type DistributionBin, type Observation } from './types'

export interface Evidence {
  metric: string
  value: number
  unit: string
  source: string
  sourceUrl: string | null
  asOf: string
  retrievedAt: string
  /** Effective level after ACS margin-of-error adjustment / weakest input. */
  confidence: ConfidenceLevel
  methodology: string
  /** Derived and sample metrics: the metrics they were computed from. */
  derivedFrom?: string[]
  observationIds?: string[]
  /** ACS coefficient of variation, when known. */
  cv?: number | null
  detail?: { bins: DistributionBin[] } | null
}

export type EvidenceMap = Record<string, Evidence>

const levelIndex = (l: ConfidenceLevel) => CONFIDENCE_LEVELS.indexOf(l)
export const weakest = (ls: ConfidenceLevel[]): ConfidenceLevel => CONFIDENCE_LEVELS[Math.max(...ls.map(levelIndex))]
const lower = (l: ConfidenceLevel, steps: number): ConfidenceLevel =>
  CONFIDENCE_LEVELS[Math.min(CONFIDENCE_LEVELS.length - 1, levelIndex(l) + steps)]

/** ACS reliability: CV ≤ 12% keep, 12–40% one level lower, > 40% two levels lower. */
export function moeAdjusted(level: ConfidenceLevel, value: number, moe: number | null | undefined): { level: ConfidenceLevel; cv: number | null } {
  if (moe === null || moe === undefined || !(value > 0) || moe < 0) return { level, cv: null }
  const cv = moe / 1.645 / value
  return { level: cv > 0.4 ? lower(level, 2) : cv > 0.12 ? lower(level, 1) : level, cv }
}

const later = (a: Observation, b: Observation) =>
  a.asOf !== b.asOf ? (a.asOf > b.asOf ? a : b) : a.retrievedAt >= b.retrievedAt ? a : b

function byMetric(obs: Observation[]): Map<string, Observation[]> {
  const m = new Map<string, Observation[]>()
  for (const o of obs) m.set(o.metric, [...(m.get(o.metric) ?? []), o])
  return m
}

function toEvidence(o: Observation): Evidence {
  const { level, cv } = moeAdjusted(o.confidence, o.value, o.moe)
  return {
    metric: o.metric,
    value: o.value,
    unit: o.unit,
    source: o.source,
    sourceUrl: o.sourceUrl,
    asOf: o.asOf,
    retrievedAt: o.retrievedAt,
    confidence: level,
    methodology: o.methodology,
    observationIds: o.id ? [o.id] : undefined,
    cv,
    detail: o.detail ?? null,
  }
}

const shiftMonths = (iso: string, months: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}
const ym = (iso: string) => iso.slice(0, 7)

/** Latest observation whose asOf falls in the same month as `target`. */
function atMonth(list: Observation[], target: string): Observation | null {
  return list.filter((o) => ym(o.asOf) === ym(target)).reduce<Observation | null>((a, b) => (a ? later(a, b) : b), null)
}

export function deriveEvidence(observations: Observation[]): EvidenceMap {
  const hist = byMetric(observations)
  const ev: EvidenceMap = {}
  for (const [metric, list] of hist) ev[metric] = toEvidence(list.reduce(later))

  const unitOf = (k: string) => METRICS[k]?.unit ?? 'ratio'
  const put = (metric: string, value: number, inputs: Evidence[], methodology: string, asOf?: string) => {
    if (!Number.isFinite(value)) return
    ev[metric] = {
      metric,
      value,
      unit: unitOf(metric),
      source: [...new Set(inputs.map((i) => i.source))].join(' + '),
      sourceUrl: null,
      asOf: asOf ?? inputs.map((i) => i.asOf).sort()[0],
      retrievedAt: inputs.map((i) => i.retrievedAt).sort().slice(-1)[0],
      confidence: weakest(inputs.map((i) => i.confidence)),
      methodology,
      derivedFrom: inputs.map((i) => i.metric),
      observationIds: inputs.flatMap((i) => i.observationIds ?? []),
    }
  }
  /** Ratio of two same-vintage values (ACS tables must come from the same release). */
  const ratio = (metric: string, num: string, den: string[], methodology: string) => {
    const n = ev[num]
    const ds = den.map((k) => ev[k])
    if (!n || ds.some((d) => !d)) return
    if (ds.some((d) => d!.asOf !== n.asOf)) return
    const total = ds.reduce((s, d) => s + d!.value, 0)
    if (total > 0) put(metric, n.value / total, [n, ...(ds as Evidence[])], methodology)
  }
  /** Change between the latest value and the one exactly `months` earlier (same month). */
  const growth = (metric: string, raw: string, months: number, methodology: string) => {
    const list = hist.get(raw)
    if (!list) return
    const latest = list.reduce(later)
    const prior = atMonth(list, shiftMonths(latest.asOf, -months))
    if (!prior || !(prior.value > 0)) return
    put(metric, latest.value / prior.value - 1, [toEvidence(latest), toEvidence(prior)], methodology, latest.asOf)
  }

  ratio('d.renter_share', 'acs.renter_occupied', ['acs.occupied_units'], 'Renter-occupied ÷ occupied units (ACS B25003, same release)')
  ratio(
    'd.rental_vacancy',
    'acs.vacant_for_rent',
    ['acs.renter_occupied', 'acs.vacant_for_rent', 'acs.rented_not_occupied'],
    'Vacant for rent ÷ (renter-occupied + vacant for rent + rented, not occupied) — Census rental vacancy rate (B25003, B25004)',
  )
  const nonOverlap = 'ACS 5-year estimates five years apart (non-overlapping periods)'
  growth('d.rent_growth_5y', 'acs.median_gross_rent', 60, `Median gross rent change, ${nonOverlap}`)
  growth('d.population_growth_5y', 'acs.population', 60, `Population change, ${nonOverlap}`)
  growth('d.household_growth_5y', 'acs.households', 60, `Household change, ${nonOverlap}`)
  growth('d.income_growth_5y', 'acs.median_household_income', 60, `Median household income change (nominal dollars), ${nonOverlap}`)
  growth('d.home_value_growth_5y', 'acs.median_home_value', 60, `Median home value change, ${nonOverlap}`)

  // Supply vs demand: housing-unit growth minus household growth (same two releases).
  const units = hist.get('acs.housing_units')
  const hh = hist.get('acs.households')
  if (units && hh) {
    const uL = units.reduce(later)
    const hL = hh.reduce(later)
    const uP = atMonth(units, shiftMonths(uL.asOf, -60))
    const hP = atMonth(hh, shiftMonths(hL.asOf, -60))
    if (uL.asOf === hL.asOf && uP && hP && uP.value > 0 && hP.value > 0)
      put(
        'd.supply_vs_households_5y',
        uL.value / uP.value - 1 - (hL.value / hP.value - 1),
        [uL, uP, hL, hP].map(toEvidence),
        `Housing-unit growth minus household growth, ${nonOverlap}. Positive = supply grew faster than households`,
        uL.asOf,
      )
  }

  // Unemployment: BLS monthly when present (fresher), otherwise ACS.
  if (ev['bls.unemployment_rate']) {
    const b = ev['bls.unemployment_rate']
    put('d.unemployment_rate', b.value, [b], 'BLS LAUS unemployment rate, latest month', b.asOf)
  } else ratio('d.unemployment_rate', 'acs.unemployed', ['acs.civilian_labor_force'], 'Unemployed ÷ civilian labor force (ACS B23025)')
  growth('d.employment_growth_1y', 'bls.employment', 12, 'BLS LAUS employment, latest month vs the same month a year earlier')

  growth('d.hpi_growth_1y', 'fred.hpi', 12, 'FHFA all-transactions HPI, latest quarter vs the same quarter a year earlier')
  const hpi = hist.get('fred.hpi')
  if (hpi) {
    const latest = hpi.reduce(later)
    const points = [0, 1, 2, 3, 4, 5].map((y) => atMonth(hpi, shiftMonths(latest.asOf, -12 * y)))
    const changes: number[] = []
    for (let y = 0; y < 5; y++) {
      const a = points[y]
      const b = points[y + 1]
      if (a && b && b.value > 0) changes.push(a.value / b.value - 1)
    }
    if (changes.length >= 3) {
      const mean = changes.reduce((s, x) => s + x, 0) / changes.length
      const sd = Math.sqrt(changes.reduce((s, x) => s + (x - mean) ** 2, 0) / changes.length)
      put(
        'd.hpi_volatility',
        sd,
        points.filter((p): p is Observation => p !== null).map(toEvidence),
        `Standard deviation of ${changes.length} year-over-year HPI changes (same quarter each year)`,
        latest.asOf,
      )
    }
  }

  ratio('d.price_reduction_share', 'fred.price_reduced_count', ['fred.active_listings'], 'Price-reduced listings ÷ active listings, same month (Realtor.com via FRED)')
  growth('d.listings_growth_1y', 'fred.active_listings', 12, 'Active listings, latest month vs the same month a year earlier (Realtor.com via FRED)')
  ratio('d.equity_rich_share', 'acs.owner_units_no_mortgage', ['acs.owner_units_total'], 'Owner-occupied units without a mortgage ÷ all owner-occupied units (ACS B25081) — proxy for equity-rich owners')
  ratio('d.effective_tax_rate', 'acs.median_re_taxes', ['acs.median_home_value'], 'Median real estate taxes paid ÷ median home value (ACS B25103, B25077)')

  const fmr = ev['hud.fmr_3br']
  const rent3 = ev['acs.median_gross_rent_3br']
  if (fmr && rent3 && rent3.value > 0)
    put('d.section8_rent_ratio', fmr.value / rent3.value, [fmr, rent3], 'HUD Fair Market Rent (3 BR) ÷ ACS median gross rent of 3-bedroom units. Above 1 = voucher rent above the typical market rent')

  const uis = ev['acs.units_in_structure_dist']
  if (uis?.detail?.bins?.length) {
    const total = uis.detail.bins.reduce((s, b) => s + b.count, 0)
    const count = (keys: string[]) => uis.detail!.bins.filter((b) => keys.includes(b.key)).reduce((s, b) => s + b.count, 0)
    if (total > 0) {
      put('d.small_mf_share', count(['2', '3_4']) / total, [uis], 'Units in 2-unit and 3–4-unit buildings ÷ all housing units (ACS B25024)')
      put('d.sfh_share', count(['1_detached']) / total, [uis], 'Single-family detached units ÷ all housing units (ACS B25024)')
    }
  }
  return ev
}
