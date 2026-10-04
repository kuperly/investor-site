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
