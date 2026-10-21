/**
 * Validation of an observation before it is stored (VF-03 §15 "validation status").
 * A value that fails is stored as rejected with its reasons (never as 0, never used in scores).
 * Sources are mandatory: an unsupported assumption is not evidence (§9).
 */
import { METRICS, type MetricUnit } from './metrics'
import { CONFIDENCE_LEVELS, type Observation } from './types'

const RANGES: Partial<Record<MetricUnit, [number, number]>> = {
  count: [0, 1e9],
  usd: [1, 1e8],
  usd_month: [1, 1e6],
  year: [1700, 2100],
  days: [0, 3650],
  index: [0.0001, 1e6],
  per_1000_units: [0, 1000],
  per_100_renters: [0, 100],
  per_1000_residents: [0, 1000],
  ordinal_1_5: [1, 5],
  flag: [0, 1],
  ratio: [0, 10],
}

/** Shares and rates that cannot exceed 100%. */
const SHARES = new Set([
  'opp.below_market_share',
  'opp.absentee_share',
  'opp.investor_owned_share',
  'risk.economic_concentration',
  'bls.unemployment_rate',
])

export function validateObservation(o: Observation, evaluationDate: string): string[] {
  const errors: string[] = []
  const def = METRICS[o.metric]
  if (!def) return [`Unknown metric "${o.metric}"`]
  if (def.kind !== 'raw') errors.push(`${o.metric} is computed, not stored`)
  if (!Number.isFinite(o.value)) errors.push('Value is not a number')
  else {
    const [min, max] = SHARES.has(o.metric) ? [0, 1] : (RANGES[def.unit] ?? [-Infinity, Infinity])
    if (def.unit !== 'distribution' && (o.value < min || o.value > max)) errors.push(`Value ${o.value} is outside the plausible range ${min}–${max} for ${def.unit}`)
    if (def.unit === 'flag' && o.value !== 0 && o.value !== 1) errors.push('A flag must be 0 or 1')
  }
  if (def.unit === 'distribution') {
    const bins = o.detail?.bins
    if (!bins?.length) errors.push('Distribution has no bins')
    else if (bins.some((b) => !Number.isFinite(b.count) || b.count < 0)) errors.push('Distribution bin counts must be ≥ 0')
  }
  if (!o.source?.trim()) errors.push('A source is required (unsupported assumptions are not accepted)')
  if (o.sourceUrl && !/^https?:\/\//i.test(o.sourceUrl)) errors.push('Source URL must start with http:// or https://')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.asOf) || Number.isNaN(Date.parse(o.asOf))) errors.push('As-of date must be YYYY-MM-DD')
  else if (o.asOf > evaluationDate) errors.push('As-of date is in the future')
  if (!CONFIDENCE_LEVELS.includes(o.confidence)) errors.push('Unknown confidence level')
  if (!o.unit || o.unit !== def.unit) errors.push(`Unit must be ${def.unit}`)
  if (o.moe !== undefined && o.moe !== null && (!Number.isFinite(o.moe) || o.moe < 0)) errors.push('Margin of error must be ≥ 0')
  return errors
}
