import { FIELD_BY_KEY } from '@/engine/fields'
import type { InputKey } from '@/engine/types'
import { money, pct } from './format'

/** Formats an audit value the way the field is displayed ("$125,000", "7.5%", "Unknown"). */
export function describeAuditValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return 'Unknown'
  const f = FIELD_BY_KEY[field as InputKey]
  if (f && typeof v === 'number') {
    if (f.kind === 'money') return money(v)
    if (f.kind === 'percent') return pct(v, 2).replace(/\.00%$/, '%')
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (f?.kind === 'gate') return v === 'yes' ? 'Yes (problem)' : v === 'no' ? 'No (cleared)' : 'Unknown'
  const s = String(v)
  return s.length > 80 ? `${s.slice(0, 80)}…` : s
}

const COMP_LABELS: Record<string, string> = {
  address: 'address', salePrice: 'sale price', saleDate: 'sale date', sqft: 'sqft', beds: 'beds', baths: 'baths',
  distanceMiles: 'distance', condition: 'condition', renovation: 'renovated', source: 'source', sourceUrl: 'link',
  notes: 'notes', included: 'included',
}

function compValue(k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return 'Unknown'
  if (k === 'salePrice' && typeof v === 'number') return money(v)
  if (k === 'included') return v ? 'Yes' : 'No (excluded)'
  return String(v)
}

/** Human-readable text for a 'comps' audit entry (add / remove / edit). */
export function describeCompAudit(oldV: unknown, newV: unknown): { title: string; detail: string } {
  const o = (oldV ?? null) as Record<string, unknown> | null
  const n = (newV ?? null) as Record<string, unknown> | null
  const brief = (c: Record<string, unknown>) =>
    [c.address, compValue('salePrice', c.salePrice), c.saleDate].filter((x) => x && x !== 'Unknown').join(' · ')
  if (!o && n) return { title: 'Comp added', detail: brief(n) }
  if (o && !n) return { title: 'Comp removed', detail: brief(o) }
  if (o && n) {
    const changes = Object.keys(COMP_LABELS)
      .filter((k) => JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null))
      .map((k) => `${COMP_LABELS[k]}: ${compValue(k, o[k])} → ${compValue(k, n[k])}`)
    return { title: `Comp edited — ${String(n.address)}`, detail: changes.join('; ') }
  }
  return { title: 'Comp', detail: '' }
}
