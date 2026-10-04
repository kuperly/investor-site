import type { CompGroupStats, CompStats } from '@/engine/comps'
import { money, num } from '@/lib/format'
import { Val } from './Val'

const months = (m: number | null) => (m === null ? 'UNKNOWN' : `${num(m, 1)} mo`)

function Group({ title, g }: { title: string; g: CompGroupStats }) {
  const rows: [string, string][] = [
    ['Comps', `${g.count}${g.withPrice < g.count ? ` (${g.withPrice} priced)` : ''}`],
    ['Median price', money(g.medianPrice)],
    ['Average price', money(g.avgPrice)],
    ['Range', g.minPrice === null ? 'UNKNOWN' : `${money(g.minPrice)} – ${money(g.maxPrice)}`],
    ['Median $/sqft', g.medianPpsf === null ? 'UNKNOWN' : `$${num(g.medianPpsf)}`],
    ['Average $/sqft', g.avgPpsf === null ? 'UNKNOWN' : `$${num(g.avgPpsf)}`],
    ['Distance (avg · max)', g.avgDistance === null ? 'UNKNOWN' : `${num(g.avgDistance, 2)} · ${num(g.maxDistance, 2)} mi`],
    ['Sale age (newest · oldest)', g.newestMonths === null ? 'UNKNOWN' : `${months(g.newestMonths)} · ${months(g.oldestMonths)}`],
  ]
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      {g.count === 0 ? (
        <p className="text-sm text-ink-muted">None</p>
      ) : (
        <dl className="space-y-0.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="text-right font-medium tabular-nums"><Val v={v} /></dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export function CompsStats({ s }: { s: CompStats }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-3 md:grid-cols-3">
        <Group title="Renovated comps" g={s.renovated} />
        <Group title="Unrenovated comps" g={s.unrenovated} />
        <Group title="All included comps" g={s.all} />
      </div>
      {(s.unclassified > 0 || s.excluded > 0) && (
        <p className="text-xs text-amber-800">
          {s.unclassified > 0 && `${s.unclassified} comp(s) not marked renovated/unrenovated (counted under "All" only). `}
          {s.excluded > 0 && `${s.excluded} comp(s) excluded from statistics.`}
        </p>
      )}
    </div>
  )
}
