/**
 * Change detection (VF-03 §16): why did a geography's priority move between two snapshots?
 *
 * The change is split into priority points:
 *  - per dimension: modifier × (dimension weight ÷ known weight) × Δ dimension score
 *    (and inside it per component, by the component's share of its dimension)
 *  - the risk-modifier effect: Δ modifier × previous core score
 *  - "evidence coverage & other": whatever is left (dimensions that became known/unknown,
 *    re-normalization), so the lines always add up to the total.
 */
import { DIMENSION_WEIGHTS, type DimensionKey, type MarketConfig } from './config'
import type { DecisionState, MarketEvaluation } from './evaluate'
import { metricLabel } from './metrics'
import type { Score } from './types'

export interface ChangeLine {
  label: string
  delta: number
  kind: 'dimension' | 'component' | 'modifier' | 'coverage'
  dimension?: DimensionKey
}

export interface MetricChange {
  metric: string
  label: string
  from: number | null
  to: number | null
  unit: string
}

export interface ChangeExplanation {
  from: Score
  to: Score
  delta: number | null
  significant: boolean
  decision: { from: DecisionState; to: DecisionState } | null
  lines: ChangeLine[]
  metricChanges: MetricChange[]
}

const r1 = (x: number) => Math.round(x * 10) / 10

export function explainChange(prev: MarketEvaluation, curr: MarketEvaluation, cfg: MarketConfig): ChangeExplanation {
  const from = prev.priority.point
  const to = curr.priority.point
  const delta = from !== null && to !== null ? r1(to - from) : null
  const decision = prev.decision.state !== curr.decision.state ? { from: prev.decision.state, to: curr.decision.state } : null
  const lines: ChangeLine[] = []

  if (from !== null && to !== null) {
    const M = curr.risk.modifier.point
    const keys = Object.keys(DIMENSION_WEIGHTS) as DimensionKey[]
    const knownW = keys.filter((k) => curr.dimensions[k].point !== null).reduce((s, k) => s + DIMENSION_WEIGHTS[k], 0)
    let explained = 0
    for (const k of keys) {
      const a = prev.dimensions[k]
      const b = curr.dimensions[k]
      if (a.point === null || b.point === null || knownW === 0) continue
      const share = DIMENSION_WEIGHTS[k] / knownW
      const d = M * share * (b.point - a.point)
      explained += d
      if (Math.abs(d) >= 0.05) lines.push({ label: b.label, delta: r1(d), kind: 'dimension', dimension: k })
      const compKnownW = b.components.filter((c) => c.score !== null).reduce((s, c) => s + c.weight, 0)
      for (const c of b.components) {
        const pc = a.components.find((x) => x.key === c.key)
        if (!pc || pc.score === null || c.score === null || compKnownW === 0 || k === 'strategyFit') continue
        const dc = M * share * (c.weight / compKnownW) * (c.score - pc.score)
        if (Math.abs(dc) >= 0.05) lines.push({ label: c.label, delta: r1(dc), kind: 'component', dimension: k })
      }
    }
    const prevCore = prev.priority.core.point
    if (prevCore !== null && curr.risk.modifier.point !== prev.risk.modifier.point) {
      const dm = (curr.risk.modifier.point - prev.risk.modifier.point) * prevCore
      explained += dm
      lines.push({ label: `Risk modifier ${prev.risk.modifier.point.toFixed(2)} → ${curr.risk.modifier.point.toFixed(2)} (${prev.risk.level ?? 'UNKNOWN'} → ${curr.risk.level ?? 'UNKNOWN'})`, delta: r1(dm), kind: 'modifier' })
    }
    const rest = (to - from) - explained
    if (Math.abs(rest) >= 0.05) lines.push({ label: 'Evidence coverage & other', delta: r1(rest), kind: 'coverage' })
  }

  const keys = [...new Set([...Object.keys(prev.evidence), ...Object.keys(curr.evidence)])]
  const metricChanges: MetricChange[] = keys
    .map((k) => ({
      metric: k,
      label: metricLabel(k),
      from: prev.evidence[k]?.value ?? null,
      to: curr.evidence[k]?.value ?? null,
      unit: (curr.evidence[k] ?? prev.evidence[k]).unit,
    }))
    .filter((m) => m.from !== m.to && m.unit !== 'distribution')

  return {
    from,
    to,
    delta,
    significant: decision !== null || (delta !== null && Math.abs(delta) >= cfg.significantChange) || (from === null) !== (to === null),
    decision,
    lines: lines.sort((a, b) => (a.kind === 'component') === (b.kind === 'component') ? Math.abs(b.delta) - Math.abs(a.delta) : a.kind === 'component' ? 1 : -1),
    metricChanges,
  }
}
