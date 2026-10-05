'use client'

import { useActionState } from 'react'
import { saveDefaults, type DefaultsState } from '@/app/settings-actions'
import { FIELD_SECTIONS, isDefaultable } from '@/engine/fields'
import { Field } from './DealForm'

export function DefaultsForm({ initial }: { initial: Record<string, string> }) {
  const [state, action, pending] = useActionState<DefaultsState, FormData>(saveDefaults, {})
  const errors = state.errors ?? {}
  const sections = FIELD_SECTIONS.map((s) => ({ ...s, fields: s.fields.filter((f) => isDefaultable(f.key)) })).filter(
    (s) => s.fields.length > 0,
  )
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">{state.error}</div>}
      {state.ok && <div role="status" className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{state.ok}</div>}
      {sections.map((s) => (
        <fieldset key={s.id} className="card">
          <legend className="sr-only">{s.title}</legend>
          <h2 className="h2">{s.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {s.fields.map((f) => (
              <Field key={f.key} f={f} defaultValue={initial[f.key] ?? ''} error={errors[f.key]} />
            ))}
          </div>
        </fieldset>
      ))}
      <button className="btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save defaults'}</button>
    </form>
  )
}
