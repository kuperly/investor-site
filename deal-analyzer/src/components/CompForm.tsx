'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { saveComp, type CompSaveState } from '@/app/comps-actions'
import { COMP_SOURCES } from '@/lib/comps/parse-comp'

interface Props {
  dealId: string
  compId?: string
  initial: Record<string, string>
}

const FIELDS: { key: string; label: string; kind: 'text' | 'money' | 'num' | 'date' | 'url'; unit?: string; wide?: boolean }[] = [
  { key: 'address', label: 'Address', kind: 'text', wide: true },
  { key: 'salePrice', label: 'Sale price', kind: 'money' },
  { key: 'saleDate', label: 'Sale date', kind: 'date' },
  { key: 'sqft', label: 'Sqft', kind: 'num' },
  { key: 'beds', label: 'Beds', kind: 'num' },
  { key: 'baths', label: 'Baths', kind: 'num' },
  { key: 'distanceMiles', label: 'Distance', kind: 'num', unit: 'mi' },
  { key: 'condition', label: 'Condition', kind: 'text' },
]

export function CompForm({ dealId, compId, initial }: Props) {
  const [state, action, pending] = useActionState<CompSaveState, FormData>(saveComp, {})
  const errors = state.errors ?? {}
  const err = (k: string) => errors[k as keyof typeof errors]

  return (
    <form action={action} className="card space-y-3" noValidate id="comp-form">
      <h2 className="h2">{compId ? 'Edit comp' : 'Add comp'}</h2>
      <input type="hidden" name="dealId" value={dealId} />
      {compId && <input type="hidden" name="compId" value={compId} />}
      <input type="hidden" name="included" value={initial.included || 'true'} />
      {state.error && (
        <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">{state.error}</div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? 'col-span-2' : ''}>
            <label className="label" htmlFor={`c_${f.key}`}>{f.label}</label>
            <div className="relative">
              {f.kind === 'money' && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted">$</span>}
              <input
                id={`c_${f.key}`}
                name={f.key}
                type={f.kind === 'date' ? 'date' : 'text'}
                inputMode={f.kind === 'money' || f.kind === 'num' ? 'decimal' : undefined}
                defaultValue={initial[f.key] ?? ''}
                placeholder={f.kind === 'text' || f.kind === 'date' ? undefined : 'Unknown'}
                aria-invalid={err(f.key) ? true : undefined}
                className={`input ${f.kind === 'money' ? 'pl-6' : ''} ${f.unit ? 'pr-8' : ''} ${err(f.key) ? 'border-rose-500' : ''}`}
              />
              {f.unit && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">{f.unit}</span>}
            </div>
            {err(f.key) && <p className="mt-0.5 text-[11px] text-rose-700">{err(f.key)}</p>}
          </div>
        ))}
        <div>
          <label className="label" htmlFor="c_renovation">Renovated?</label>
          <select id="c_renovation" name="renovation" defaultValue={initial.renovation ?? ''} className="input">
            <option value="">Unknown</option>
            <option value="renovated">Renovated</option>
            <option value="unrenovated">Unrenovated</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="c_source">Source</label>
          <input id="c_source" name="source" list="comp-sources" defaultValue={initial.source || 'Manual'} className="input" />
          <datalist id="comp-sources">
            {COMP_SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="c_sourceUrl">Source link</label>
          <input id="c_sourceUrl" name="sourceUrl" type="url" defaultValue={initial.sourceUrl ?? ''} placeholder="https://…" className={`input ${err('sourceUrl') ? 'border-rose-500' : ''}`} />
          {err('sourceUrl') && <p className="mt-0.5 text-[11px] text-rose-700">{err('sourceUrl')}</p>}
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className="label" htmlFor="c_notes">Notes</label>
          <textarea id="c_notes" name="notes" rows={2} defaultValue={initial.notes ?? ''} className="input" />
        </div>
      </div>
      <p className="text-xs text-ink-muted">Leave unknown fields blank — they stay UNKNOWN and are skipped in the statistics, never counted as $0.</p>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? 'Saving…' : compId ? 'Save comp' : 'Add comp'}</button>
        {compId && <Link href={`/deals/${dealId}/comps`} className="btn-secondary">Cancel</Link>}
      </div>
    </form>
  )
}
