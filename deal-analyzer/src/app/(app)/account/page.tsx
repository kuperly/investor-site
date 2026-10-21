import { changeOwnPassword, signOutEverywhere } from '@/app/auth-actions'
import { ActionForm } from '@/components/ActionForm'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await requireUser()
  if (user.openAccess)
    return <p className="text-sm text-ink-soft">Login is off on this deployment (AUTH_DISABLED=1), so there is no account to manage.</p>
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Account</h1>
      <p className="text-sm text-ink-soft">
        Signed in as <strong>{user.displayName}</strong> ({user.username}, {user.role}). Your changes are recorded under this name.
      </p>
      <section className="card">
        <h2 className="h2">Change password</h2>
        <ActionForm action={changeOwnPassword} submitLabel="Change password">
          <div>
            <label className="label" htmlFor="current">Current password</label>
            <input id="current" name="current" type="password" className="input" autoComplete="current-password" required />
          </div>
          <div>
            <label className="label" htmlFor="next">New password (12+ characters)</label>
            <input id="next" name="next" type="password" className="input" autoComplete="new-password" required minLength={12} />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Repeat new password</label>
            <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required minLength={12} />
          </div>
        </ActionForm>
      </section>
      <section className="card">
        <h2 className="h2">Sessions</h2>
        <form action={signOutEverywhere}>
          <button className="btn-secondary">Sign out on every device</button>
        </form>
      </section>
    </div>
  )
}
