import type { DecisionState } from '../engine/evaluate'
import { DECISION_LABELS, DECISION_STYLES } from './format'

export function DecisionBadge({ state }: { state: DecisionState }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-bold tracking-wide ${DECISION_STYLES[state]}`}>{DECISION_LABELS[state]}</span>
}

const RISK_STYLES: Record<string, string> = {
  Low: 'text-emerald-800',
  Moderate: 'text-lime-800',
  Elevated: 'text-amber-800',
  High: 'text-rose-800',
  Critical: 'text-rose-900 font-bold',
}

export function RiskText({ level }: { level: string | null }) {
  return <span className={level ? RISK_STYLES[level] : 'unknown'}>{level ?? 'UNKNOWN'}</span>
}

/** Small inline trend line of priority over snapshots (oldest → newest). */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  if (pts.length < 2) return null
  const w = 120
  const h = 28
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 4) + 2
  const y = (v: number) => h - 2 - (v / 100) * (h - 4)
  return (
    <svg width={w} height={h} role="img" aria-label="Priority trend" className="inline-block align-middle">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand" points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} />
    </svg>
  )
}
