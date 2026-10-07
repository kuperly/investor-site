'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { saveDeal, type SaveState } from '@/app/actions'
import { analyzeDeal, type DealAnalysis } from '@/engine/analyze'
import { isCompSummaryKey } from '@/engine/comps'
import { FIELD_SECTIONS, type FieldDef } from '@/engine/fields'
import { DEAL_STATUSES, type DealStatus, type InputKey } from '@/engine/types'
import { dscrText, money, pct } from '@/lib/format'
import { NOTE_CATEGORIES, type DealNotes } from '@/lib/notes'
import { parseDealForm } from '@/lib/parse-inputs'
import { RecBadge } from './RecBadge'
import { IncompleteLegend, Val } from './Val'

interface Props {
  /** Deal version the form was opened at (optimistic locking). */
  version?: number
  id?: string
  initialValues: Record<string, string>
  initialNotes: DealNotes
  initialStatus: DealStatus
  /** ValeForge defaults as form strings (only fields that have a default). */
  defaults?: Record<string, string>
  /** Fields currently holding an unconfirmed default. */
  initialDefaulted?: string[]
  /** Comp summary fields, formatted, derived from the comps list (read-only). */
  compSummary?: Record<string, string>
}

export function DealForm({ id, version, initialValues, initialNotes, initialStatus, defaults = {}, initialDefaulted = [], compSummary }: Props) {
  const [values, setValues] = useState(initialValues)
  const [defaulted, setDefaulted] = useState<Set<string>>(() => new Set(initialDefaulted))
  const [state, action, pending] = useActionState<SaveState, FormData>(saveDeal, {})

  // Live underwriting: the same engine the server uses, re-run on every keystroke.
  const preview = useMemo(() => {
    const { inputs } = parseDealForm((k) => values[k] ?? null)
    return analyzeDeal(inputs)
  }, [values])

  const set = (k: string, v: string) => {
    setValues((s) => ({ ...s, [k]: v }))
    // Editing a defaulted field confirms it for this deal.
    setDefaulted((d) => (d.has(k) ? new Set([...d].filter((x) => x !== k)) : d))
  }
  const blanksWithDefault = Object.keys(defaults).filter((k) => (values[k] ?? '').trim() === '')
  const fillBlanks = () => {
    setValues((s) => ({ ...s, ...Object.fromEntries(blanksWithDefault.map((k) => [k, defaults[k]])) }))
    setDefaulted((d) => new Set([...d, ...blanksWithDefault]))
  }
  const errors = state.errors ?? {}

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_300px]" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {version !== undefined && <input type="hidden" name="version" value={version} />}
      <input type="hidden" name="defaulted" value={JSON.stringify([...defaulted])} />

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
          {(defaulted.size > 0 || blanksWithDefault.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-950">
              {defaulted.size > 0 && (
                <>
                  <span>
                    <strong>{defaulted.size}</strong> field{defaulted.size === 1 ? '' : 's'} use ValeForge defaults (marked <em>Default</em>).
                    Editing a field confirms it.
                  </span>
                  <button type="button" className="btn-secondary min-h-[32px] px-2 py-1 text-xs" onClick={() => setDefaulted(new Set())}>
                    Confirm all defaults
                  </button>
                </>
              )}
              {blanksWithDefault.length > 0 && (
                <button type="button" className="btn-secondary min-h-[32px] px-2 py-1 text-xs" onClick={fillBlanks}>
                  Fill {blanksWithDefault.length} blank{blanksWithDefault.length === 1 ? '' : 's'} from defaults
                </button>
              )}
            </div>
          )}
        </section>

        {FIELD_SECTIONS.map((section) => (
          <fieldset key={section.id} className="card">
            <legend className="sr-only">{section.title}</legend>
            <h2 className="h2">{section.title}</h2>
            {section.description && <p className="-mt-2 mb-3 text-xs text-ink-muted">{section.description}</p>}
            <div className={`grid gap-3 ${section.id === 'gates' ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>
              {section.fields.map((f) =>
                f.key === 'closingCostAmount' && (values.closingCostPct ?? '').trim() !== '' ? (
                  <Computed key={f.key} label={f.label} value={money(preview.base.closingCosts)} note="Purchase × Closing %" />
                ) : isCompSummaryKey(f.key) ? (
                  <Computed
                    key={f.key}
                    label={f.label}
                    value={compSummary?.[f.key] ?? 'UNKNOWN'}
                    note={id ? 'from the comps list' : 'from the comps list (add comps after saving)'}
                  />
                ) : (
                  <Field
                    key={f.key}
                    f={f}
                    value={values[f.key] ?? ''}
                    onChange={set}
                    error={errors[f.key]}
                    isDefault={defaulted.has(f.key)}
                  />
                ),
              )}
            </div>
            <SectionResults id={section.id} a={preview} />
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
                ['All-in', money(preview.base.totalProjectCost), preview.base.inc.allIn],
                ['Equity created', money(preview.base.equityCreated), preview.base.inc.allIn],
                ['All-in / ARV', pct(preview.base.allInToArv), preview.base.inc.allIn],
                ['Max Offer (Base)', money(preview.arvScenarios[1].maxOffer.maxPurchasePrice), preview.base.inc.maxOffer],
                ['Cash left', money(preview.base.refi.cashLeftInDeal), preview.base.inc.cashLeft],
                ['DSCR', dscrText(preview.base.refi.dscr, preview.base.refi.annualDebtService), preview.base.inc.dscr],
                ['Cash flow / mo', money(preview.base.refi.monthlyCashFlow), preview.base.inc.dscr],
                ['Flip profit', money(preview.base.flip.netProfit), preview.base.inc.flip],
              ] as const
            ).map(([k, v, inc]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="font-medium tabular-nums"><Val v={v} inc={inc} /></dd>
              </div>
            ))}
          </dl>
          <IncompleteLegend
            show={
              (preview.base.totalProjectCost !== null && preview.base.inc.allIn.length > 0) ||
              (preview.base.rental !== null && preview.base.inc.noi.length > 0)
            }
          />
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

/**
 * One input, driven by the field registry. Controlled (value + onChange) in the deal
 * form, uncontrolled (defaultValue) on the Settings page.
 */
export function Field({
  f,
  value,
  defaultValue,
  onChange,
  error,
  isDefault = false,
}: {
  f: FieldDef
  value?: string
  defaultValue?: string
  onChange?: (k: string, v: string) => void
  error?: string
  /** Value came from ValeForge defaults and isn't confirmed for this deal yet. */
  isDefault?: boolean
}) {
  const id = `f_${f.key}`
  const change = (v: string) => onChange?.(f.key, v)
  const common = {
    id,
    name: f.key,
    ...(value !== undefined ? { value } : { defaultValue }),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || f.help || isDefault ? `${id}_d` : undefined,
    className: `input ${error ? 'border-rose-500' : isDefault ? 'border-teal-400 bg-teal-50/40' : ''}`,
  }
  let control: React.ReactNode
  if (f.kind === 'enum') {
    control = (
      <select {...common} onChange={(e) => change(e.target.value)}>
        <option value="">Unknown</option>
        {f.options!.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    )
  } else if (f.kind === 'boolean') {
    control = (
      <select {...common} onChange={(e) => change(e.target.value)}>
        <option value="">Unknown</option>
        <option value="true">Yes</option>
        <option value="false">No (amortizing)</option>
      </select>
    )
  } else if (f.kind === 'gate') {
    control = (
      <select {...common} onChange={(e) => change(e.target.value)}>
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
          onChange={(e) => change(e.target.value)}
          className={`${common.className} ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">{suffix}</span>}
      </div>
    )
  }
  return (
    <div className={f.kind === 'gate' ? '' : f.key === 'address' ? 'col-span-2' : ''}>
      <label className="label flex items-center gap-1.5" htmlFor={id}>
        {f.label}
        {isDefault && <span className="rounded bg-teal-100 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-teal-900">Default</span>}
      </label>
      {control}
      {(error || f.help || isDefault) && (
        <p id={`${id}_d`} className={`mt-0.5 text-[11px] ${error ? 'text-rose-700' : 'text-ink-muted'}`}>
          {error ?? (isDefault ? 'ValeForge default — confirm or change for this deal.' : f.help)}
        </p>
      )}
    </div>
  )
}

/** Read-only calculated value shown in place of an input. */
function Computed({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex min-h-[40px] items-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-2.5 text-sm font-medium tabular-nums">
        <Val v={value} />
      </div>
      <p className="mt-0.5 text-[11px] text-ink-muted">Calculated: {note}</p>
    </div>
  )
}

type Out = [label: string, value: string, inc?: readonly InputKey[]]

/** What each form section calculates, live (all numbers from the engine). */
function sectionResults(id: string, a: DealAnalysis): Out[] {
  const b = a.base
  const I = b.inc
  switch (id) {
    case 'purchase':
      return [
        ['Closing costs', money(b.closingCosts)],
        ['Inspection + attorney + title + other', money(b.otherProjectCosts), I.otherProjectCosts],
      ]
    case 'project':
      return [['All-in so far', money(b.totalProjectCost), I.allIn]]
    case 'rehab':
      return [
        ['Contingency', money(b.rehabContingency)],
        ['Total rehab', money(b.totalRehab), I.totalRehab],
      ]
    case 'acqFinancing':
      return [
        ['Loan', money(b.acquisitionLoan)],
        ['Points', money(b.acquisitionPoints)],
        ['Financing fees', money(b.financingFees), I.financingFees],
        ['Interest over project', money(b.acquisitionInterest)],
        ['Payoff at refi', money(b.outstandingAcquisitionLoan)],
      ]
    case 'refi':
      return [
        ['Refi loan', money(b.refi.refiLoan)],
        ['Refi closing', money(b.refi.refiClosingCosts)],
        ['Cash from refi', money(b.refi.cashAvailableFromRefi), I.refiCash],
        ['Debt service / yr', money(b.refi.annualDebtService)],
      ]
    case 'value':
      return [
        ['Equity (Base)', money(b.equityCreated), I.allIn],
        ['All-in / ARV', pct(b.allInToArv), I.allIn],
      ]
    case 'rental':
      return [
        ['Gross rent / yr', money(b.rental?.grossScheduledRent ?? null)],
        ['NOI', money(b.rental?.noi ?? null), I.noi],
        ['DSCR', dscrText(b.refi.dscr, b.refi.annualDebtService), I.dscr],
        ['Cash flow / mo', money(b.refi.monthlyCashFlow), I.dscr],
      ]
    case 'flip':
      return [
        ['Selling costs', money(b.flip.sellingCosts)],
        ['Flip profit', money(b.flip.netProfit), I.flip],
        ['Max Offer (Base)', money(a.arvScenarios[1].maxOffer.maxPurchasePrice), I.maxOffer],
      ]
    default:
      return []
  }
}

function SectionResults({ id, a }: { id: string; a: DealAnalysis }) {
  const rows = sectionResults(id, a)
  if (rows.length === 0) return null
  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-md bg-brand-light/60 px-3 py-2 text-xs" aria-label="Calculated from this section">
      {rows.map(([k, v, inc]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="text-ink-soft">{k}:</dt>
          <dd className="font-semibold tabular-nums"><Val v={v} inc={inc} /></dd>
        </div>
      ))}
    </dl>
  )
}
