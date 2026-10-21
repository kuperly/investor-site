'use client'

import { useActionState } from 'react'

export interface ActionFormState {
  ok?: string
  error?: string
  /** Field → problem; listed under the error. */
  errors?: Record<string, string>
}

/** A form bound to a server action that returns { ok?, error? }; shows the message inline. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = 'Saving…',
  className = 'space-y-3',
  buttonClassName = 'btn-primary',
  children,
}: {
  action: (prev: ActionFormState, fd: FormData) => Promise<ActionFormState>
  submitLabel: string
  pendingLabel?: string
  className?: string
  buttonClassName?: string
  children: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState<ActionFormState, FormData>(action, {})
  return (
    <form action={formAction} className={className}>
      {state.error && (
        <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">
          {state.error}
          {state.errors && Object.keys(state.errors).length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(state.errors).map(([k, v]) => (
                <li key={k}>
                  <strong>{k}</strong>: {v}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.ok && (
        <div role="status" className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-900">
          {state.ok}
        </div>
      )}
      {children}
      <button className={buttonClassName} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}
