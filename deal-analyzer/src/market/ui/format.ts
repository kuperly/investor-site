/** Display helpers for VF-03. UNKNOWN is shown explicitly — never as 0. */
import type { DecisionState } from '../engine/evaluate'
import type { FreshnessStatus } from '../engine/freshness'
import { CONFIDENCE_LABELS, type ConfidenceLevel, type Partial100 } from '../engine/types'

export const UNKNOWN = 'UNKNOWN'

export function metricValue(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined || Number.isNaN(v)) return UNKNOWN
  switch (unit) {
    case 'usd':
      return `$${Math.round(v).toLocaleString('en-US')}`
    case 'usd_month':
      return `$${Math.round(v).toLocaleString('en-US')}/mo`
    case 'ratio':
      return `${(v * 100).toFixed(Math.abs(v) < 0.1 ? 2 : 1)}%`
    case 'count':
      return Math.round(v).toLocaleString('en-US')
    case 'days':
      return `${Math.round(v)} days`
    case 'year':
      return String(Math.round(v))
    case 'flag':
      return v === 1 ? 'Yes' : 'No'
    case 'ordinal_1_5':
      return `${v} / 5`
    case 'distribution':
      return `${Math.round(v).toLocaleString('en-US')} units (distribution)`
    case 'per_1000_units':
      return `${v.toFixed(1)} per 1,000 units`
    case 'per_100_renters':
      return `${v.toFixed(1)} per 100 renters`
    case 'per_1000_residents':
      return `${v.toFixed(1)} per 1,000 residents`
    default:
      return v.toLocaleString('en-US', { maximumFractionDigits: 3 })
  }
}

export const score = (v: number | null | undefined) => (v === null || v === undefined ? UNKNOWN : v.toFixed(0))

/** A priority is a number only when the evidence supports it; otherwise a range. */
export function priorityText(p: Partial100 & { display?: 'precise' | 'range'; blocked?: boolean }): string {
  if (p.blocked) return 'BLOCKED'
  if (p.display === 'precise' && p.point !== null) return p.point.toFixed(0)
  // Complete but weak evidence: an approximate value, never a precise score or rank.
  if (Math.round(p.low) === Math.round(p.high)) return `≈${p.low.toFixed(0)}`
  return `${p.low.toFixed(0)}–${p.high.toFixed(0)}`
}

export const DECISION_STYLES: Record<DecisionState, string> = {
  KEEP: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  DRILL_DOWN: 'bg-sky-100 text-sky-900 border-sky-300',
  WATCH: 'bg-amber-100 text-amber-900 border-amber-300',
  DROP: 'bg-rose-100 text-rose-900 border-rose-300',
}

export const DECISION_LABELS: Record<DecisionState, string> = { KEEP: 'KEEP', DRILL_DOWN: 'DRILL DOWN', WATCH: 'WATCH', DROP: 'DROP' }

export const FRESHNESS_STYLES: Record<FreshnessStatus, string> = {
  fresh: 'text-emerald-800',
  aging: 'text-amber-800',
  stale: 'text-rose-800 font-semibold',
}

export const confidenceLabel = (c: ConfidenceLevel) => CONFIDENCE_LABELS[c]

export const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}`
