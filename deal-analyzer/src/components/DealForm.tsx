'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { saveDeal, type SaveState } from '@/app/actions'
import { analyzeDeal } from '@/engine/analyze'
import { FIELD_SECTIONS, type FieldDef } from '@/engine/fields'
import { DEAL_STATUSES, type DealStatus } from '@/engine/types'
import { dscrText, money, pct } from '@/lib/format'
import { NOTE_CATEGORIES, type DealNotes } from '@/lib/notes'
import { parseDealForm } from '@/lib/parse-inputs'
import { RecBadge } from './RecBadge'
import { Val } from './Val'

interface Props {
  id?: string
  initialValues: Record<string, string>
  initialNotes: DealNotes
  initialStatus: DealStatus
}

export function DealForm({ id, initialValues, initialNotes, initialStatus }: Props) {
  const [values, setValues] = useState(initialValues)
  const [state, action, pending] = useActionState<SaveState, FormData>(saveDeal, {})

  // Live underwriting: the same engine the server uses, re-run on every keystroke.
  const preview = useMemo(() => {
    const { inputs } = parseDealForm((k) => values[k] ?? null)
    return analyzeDeal(inputs)
  }, [values])

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }))
  const errors = state.errors ?? {}

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_300px]" noValidate>
      {id && <input type="hidden" name="id" value={id} />}

      <div className="space-y-4">
        {state.error && (
          <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
            {state.error}
          </div>
        )}

        <section className="card">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={initialStatus} className="input max-w-xs">
            {DEAL_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-ink-muted">
            Leave anything you don&apos;t know blank — it is stored as <strong>UNKNOWN</strong>, never as $0. Enter 0 only when the true value is zero.
          </p>
        </section>

        {FIELD_SECTIONS.map((section) => (
          <fieldset key={section.id} className="card">
            <legend className="sr-only">{section.title}</legend>
            <h2 className="h2">{section.title}</h2>
            {section.description && <p className="-mt-2 mb-3 text-xs text-ink-muted">{section.description}</p>}
            <div className={`grid gap-3 ${section.id === 'gates' ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>
              {section.fields.map((f) => (
                <Field key={f.key} f={f} value={values[f.key] ?? ''} onChange={set} error={errors[f.key]} />
              ))}
            </div>
          </fieldset>
        ))}

        <fieldset className="card">
          <legend className="sr-only">Deal notes</legend>
          <h2 className="h2">Deal notes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {NOTE_CATEGORIES.map((n) => (
              <div key={n.key}>
                <label className="label" htmlFor={`note_${n.key}`}>{n.label}</label>
                <textarea id={`note_${n.key}`} name={`note_${n.key}`} rows={3} defaultValue={initialNotes[n.key] ?? ''} className="input" />
              </div>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-2">
          <button className="btn-primary" disabled={pending}>{pending ? 'Saving…' : id ? 'Save changes' : 'Create deal'}</button>
          <Link href={id ? `/deals/${id}` : '/'} className="btn-secondary">Cancel</Link>
        </div>
      </div>

      {/* Live preview */}
      <aside className="order-first lg:order-none">
        <div className="card lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Live score</div>
              <div className="text-3xl font-bold tabular-nums">{preview.score.total}</div>
            </div>
            <RecBadge rec={preview.recommendation.recommendation} />
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            {(
              [
                ['All-in', money(preview.base.totalProjectCost)],
                ['Equity created', money(preview.base.equityCreated)],
                ['All-in / ARV', pct(preview.base.allInToArv)],
                ['Max Offer (Base)', money(preview.arvScenarios[1].maxOffer.maxPurchasePrice)],
                ['Cash left', money(preview.base.refi.cashLeftInDeal)],
                ['DSCR', dscrText(preview.base.refi.dscr, preview.base.refi.annualDebtService)],
                ['Cash flow / mo', money(preview.base.refi.monthlyCashFlow)],
                ['Flip profit', money(preview.base.flip.netProfit)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="font-medium tabular-nums"><Val v={v} /></dd>
              </div>
            ))}
          </dl>
          {preview.missing.length > 0 && (
            <details className="mt-3 text-xs text-amber-900">
              <summary className="cursor-pointer font-semibold">{preview.missing.length} input(s) still UNKNOWN</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {preview.missing.map((m) => (
                  <li key={m.field}>{m.message.replace('Underwriting incomplete — ', '')}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </aside>
    </form>
  )
}

function Field({ f, value, onChange, error }: { f: FieldDef; value: string; onChange: (k: string, v: string) => void; error?: string }) {
  const id = `f_${f.key}`
  const common = {
    id,
    name: f.key,
    value,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || f.help ? `${id}_d` : undefined,
    className: `input ${error ? 'border-rose-500' : ''}`,
  }
  let control: React.ReactNode
  if (f.kind === 'enum') {
    control = (
      <select {...common} onChange={(e) => onChange(f.key, e.target.value)}>
        <option value="">Unknown</option>
        {f.options!.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    )
  } else if (f.kind === 'boolean') {
    control = (
      <select {...common} onChange={(e) => onChange(f.key, e.target.value)}>
        <option value="">Unknown</option>
        <option value="true">Yes</option>
        <option value="false">No (amortizing)</option>
      </select>
    )
  } else if (f.kind === 'gate') {
    control = (
      <select {...common} onChange={(e) => onChange(f.key, e.target.value)}>
        <option value="unknown">Unknown — not yet assessed</option>
        <option value="no">No — cleared</option>
        <option value="yes">Yes — problem exists (PASS)</option>
      </select>
    )
  } else {
    const prefix = f.kind === 'money' ? '$' : null
    const suffix = f.kind === 'percent' ? '%' : f.unit ?? null
    control = (
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted">{prefix}</span>}
        <input
          {...common}
          type="text"
          inputMode={f.kind === 'text' ? 'text' : 'decimal'}
          placeholder={f.kind === 'text' ? '' : 'Unknown'}
          onChange={(e) => onChange(f.key, e.target.value)}
          className={`${common.className} ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">{suffix}</span>}
      </div>
    )
  }
  return (
    <div className={f.kind === 'gate' ? '' : f.key === 'address' ? 'col-span-2' : ''}>
      <label className="label" htmlFor={id}>{f.label}</label>
      {control}
      {(error || f.help) && (
        <p id={`${id}_d`} className={`mt-0.5 text-[11px] ${error ? 'text-rose-700' : 'text-ink-muted'}`}>{error ?? f.help}</p>
      )}
    </div>
  )
}
