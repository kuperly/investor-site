'use client'

import { useActionState } from 'react'
import { signIn, type FormState } from '@/app/auth-actions'

/** Own component so the username survives a failed attempt (React resets forms after an action). */
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState & { username?: string }, FormData>(signIn, {})
  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">
          {state.error}
        </div>
      )}
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input key={state.username ?? ''} id="username" name="username" className="input" autoComplete="username" autoCapitalize="none" defaultValue={state.username ?? ''} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
