/**
 * FormData → DealInputs. Blank → null (UNKNOWN), never 0 (AC18).
 * Only structural validation here (types, ranges); no business thresholds.
 */
import { ALL_FIELDS, emptyInputs, type FieldDef } from '@/engine/fields'
import type { DealInputs } from '@/engine/types'

export type FieldErrors = Partial<Record<keyof DealInputs, string>>

const POSITIVE_ONLY = new Set<keyof DealInputs>(['acqTermYears', 'refiTermYears'])

export function parseNumber(raw: string): number | null | 'invalid' {
  const s = raw.replace(/[$,%\s]/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : 'invalid'
}

function parseField(f: FieldDef, raw: string): { value: unknown; error?: string } {
  const s = raw.trim()
  switch (f.kind) {
    case 'text':
      return { value: s === '' ? null : s.slice(0, 500) }
    case 'enum':
      if (s === '') return { value: null }
      return f.options?.includes(s) ? { value: s } : { value: null, error: 'Invalid option' }
    case 'boolean':
      return { value: s === 'true' ? true : s === 'false' ? false : null }
    case 'gate':
      return { value: s === 'yes' || s === 'no' ? s : 'unknown' }
    default: {
      const n = parseNumber(s)
      if (n === null) return { value: null }
      if (n === 'invalid') return { value: null, error: 'Enter a number' }
      if (n < 0) return { value: null, error: 'Cannot be negative' }
      if (f.kind === 'integer' && !Number.isInteger(n)) return { value: null, error: 'Enter a whole number' }
      if (POSITIVE_ONLY.has(f.key) && n === 0) return { value: null, error: 'Must be greater than 0' }
      if (f.kind === 'percent') {
        if (n > 100) return { value: null, error: 'Enter a percentage between 0 and 100' }
        return { value: Number((n / 100).toPrecision(12)) }
      }
      return { value: n }
    }
  }
}

export function parseDealForm(get: (key: string) => string | null): { inputs: DealInputs; errors: FieldErrors } {
  const inputs = emptyInputs() as unknown as Record<string, unknown>
  const errors: FieldErrors = {}
  for (const f of ALL_FIELDS) {
    const { value, error } = parseField(f, get(f.key) ?? '')
    inputs[f.key] = value
    if (error) errors[f.key] = error
  }
  if (!inputs.address) errors.address = 'Address is required'
  return { inputs: inputs as unknown as DealInputs, errors }
}

/** DealInputs → form string values (percent decimals shown as whole percents). */
export function toFormValues(inputs: DealInputs): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of ALL_FIELDS) {
    const v = inputs[f.key]
    if (v === null || v === undefined) out[f.key] = f.kind === 'gate' ? 'unknown' : ''
    else if (f.kind === 'percent') out[f.key] = String(Number(((v as number) * 100).toPrecision(12)))
    else out[f.key] = String(v)
  }
  return out
}
