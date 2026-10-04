import type { Recommendation } from '@/engine/types'

const STYLE: Record<Recommendation, { cls: string; dot: string }> = {
  BUY: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30', dot: '🟢' },
  INVESTIGATE: { cls: 'bg-amber-50 text-amber-900 ring-amber-600/30', dot: '🟡' },
  PASS: { cls: 'bg-rose-50 text-rose-800 ring-rose-600/30', dot: '🔴' },
}

export function RecBadge({ rec, size = 'sm' }: { rec: Recommendation; size?: 'sm' | 'lg' }) {
  const s = STYLE[rec]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset ${s.cls} ${
        size === 'lg' ? 'px-3 py-1 text-lg' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <span aria-hidden>{s.dot}</span> {rec}
    </span>
  )
}
