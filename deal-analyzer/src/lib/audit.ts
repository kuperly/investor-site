import type { DealInputs } from '@/engine/types'
import type { DealNotes } from './notes'

export interface FieldChange {
  field: string
  oldValue: unknown
  newValue: unknown
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** §33 — every changed input / note / status becomes one audit row. */
export function diffDeal(
  before: { inputs: DealInputs; notes: DealNotes; status: string },
  after: { inputs: DealInputs; notes: DealNotes; status: string },
): FieldChange[] {
  const changes: FieldChange[] = []
  const inputKeys = new Set([...Object.keys(before.inputs), ...Object.keys(after.inputs)]) as Set<keyof DealInputs>
  for (const k of inputKeys) {
    if (!same(before.inputs[k], after.inputs[k])) changes.push({ field: k, oldValue: before.inputs[k] ?? null, newValue: after.inputs[k] ?? null })
  }
  const noteKeys = new Set([...Object.keys(before.notes), ...Object.keys(after.notes)]) as Set<keyof DealNotes>
  for (const k of noteKeys) {
    const o = before.notes[k] || null
    const n = after.notes[k] || null
    if (!same(o, n)) changes.push({ field: `notes.${k}`, oldValue: o, newValue: n })
  }
  if (before.status !== after.status) changes.push({ field: 'status', oldValue: before.status, newValue: after.status })
  return changes
}
