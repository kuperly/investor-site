/**
 * Market-level Capital Efficiency (VF-03 §6) from deal samples. Every sample is underwritten
 * by the Deal Analyzer engine itself (analyzeDeal) — VF-03 duplicates no underwriting formula.
 * It only takes ratios of the engine's own outputs and the median across samples.
 */
import { analyzeDeal } from '@/engine/analyze'
import type { DealInputs } from '@/engine/types'
import { weakest, type Evidence } from './derive'
import type { DealSample } from './types'

export interface SampleInput extends DealSample {
  inputs: DealInputs
}

export interface SampleResult {
  sample: DealSample
  /** Metric → value; a metric is absent when the Deal Analyzer result it needs is UNKNOWN. */
  values: Record<string, number>
  /** True when the Deal Analyzer marked a total incomplete (some line item UNKNOWN). */
  incomplete: boolean
  recommendation: string
  missing: string[]
}

const div = (a: number | null, b: number | null) => (a === null || b === null || b <= 0 ? null : a / b)

export function sampleMetrics(s: SampleInput): SampleResult {
  const a = analyzeDeal(s.inputs)
  const b = a.base
  const strat = a.strategies
  const v: Record<string, number | null> = {
    'ce.equity_per_capital': div(b.equityCreated, b.refi.totalCashInvested),
    'ce.profit_per_capital': b.flip.roi,
    'ce.capital_recycled': b.refi.capitalRecycledPct,
    'ce.cash_flow_per_capital': div(b.refi.annualCashFlow, b.refi.totalCashInvested),
    'ce.leverage': div(b.acquisitionLoan, b.totalProjectCost),
    'ce.refi_potential': div(b.refi.refiLoan, b.totalProjectCost),
    // Only when all three are decided; an UNKNOWN viability makes the count unknown.
    'ce.exit_paths': [strat.brrrr, strat.hold, strat.flip].some((x) => x.viable === null)
      ? null
      : [strat.brrrr, strat.hold, strat.flip].filter((x) => x.viable === true).length,
  }
  const values = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && Number.isFinite(x))) as Record<string, number>
  const incomplete = Object.values(b.inc).some((list) => list.length > 0)
  return {
    sample: s,
    values,
    incomplete,
    recommendation: a.recommendation.recommendation,
    missing: a.missing.map((m) => m.field),
  }
}

export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Median of each metric across samples, as evidence with the samples' provenance. */
export function capitalEvidence(samples: SampleInput[]): { evidence: Record<string, Evidence>; results: SampleResult[] } {
  const results = samples.map(sampleMetrics)
  const evidence: Record<string, Evidence> = {}
  const keys = [...new Set(results.flatMap((r) => Object.keys(r.values)))]
  for (const k of keys) {
    const used = results.filter((r) => k in r.values)
    if (used.length === 0) continue
    // A partial Deal Analyzer total is optimistic: it can't be stronger evidence than "single secondary".
    const levels = used.map((r) => (r.incomplete ? weakest([r.sample.confidence, 'single_secondary']) : r.sample.confidence))
    evidence[k] = {
      metric: k,
      value: median(used.map((r) => r.values[k])),
      unit: k === 'ce.exit_paths' ? 'count' : 'ratio',
      source: `Deal Analyzer on ${used.length} sample${used.length === 1 ? '' : 's'}: ${used.map((r) => r.sample.label).join('; ')}`,
      sourceUrl: null,
      asOf: used.map((r) => r.sample.asOf).sort()[0],
      retrievedAt: used.map((r) => r.sample.asOf).sort().slice(-1)[0],
      confidence: weakest(levels),
      methodology: `Median across samples of the Deal Analyzer's own outputs (analyzeDeal)${used.some((r) => r.incomplete) ? '; some samples are incomplete (optimistic)' : ''}`,
      derivedFrom: used.map((r) => r.sample.id),
    }
  }
  return { evidence, results }
}
