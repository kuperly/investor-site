import { createUser, resetUserPassword, updateUser } from '@/app/auth-actions'
import { ActionForm } from '@/components/ActionForm'
import { getDb } from '@/lib/db'
import { dateTime } from '@/lib/format'
import { requireAdmin } from '@/lib/session'
import { ROLES } from '@/lib/users'
import { usersRepo } from '@/lib/users-repo'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const me = await requireAdmin()
  const users = await usersRepo(await getDb()).list()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          Everyone signs in with their own account; every change in the Deal Analyzer and Market Intelligence is recorded under
          their display name. Admins can manage users and change Market Intelligence scoring configuration.
        </p>
      </div>
      <section className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role / active</th>
              <th>Reset password</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'opacity-60'}>
                <td className="font-medium">{u.displayName}{u.id === me.id && ' (you)'}</td>
                <td>{u.username}</td>
                <td>
                  <ActionForm action={updateUser} submitLabel="Save" className="flex items-center gap-2" buttonClassName="btn-secondary min-h-[36px] py-1">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role} className="input w-28" aria-label={`Role for ${u.displayName}`}>
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="active" defaultChecked={u.active} /> active
                    </label>
                  </ActionForm>
                </td>
                <td>
                  <ActionForm action={resetUserPassword} submitLabel="Reset" className="flex items-center gap-2" buttonClassName="btn-secondary min-h-[36px] py-1">
                    <input type="hidden" name="id" value={u.id} />
                    <input name="password" type="password" className="input w-44" placeholder="New password (12+)" autoComplete="new-password" aria-label={`New password for ${u.displayName}`} />
                  </ActionForm>
                </td>
                <td className="text-xs text-ink-muted">{dateTime(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card max-w-md">
        <h2 className="h2">Add a user</h2>
        <ActionForm action={createUser} submitLabel="Create user">
          <div>
            <label className="label" htmlFor="nu-username">Username (lowercase)</label>
            <input id="nu-username" name="username" className="input" autoCapitalize="none" required />
          </div>
          <div>
            <label className="label" htmlFor="nu-display">Display name (shown in audit trails)</label>
            <input id="nu-display" name="displayName" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="nu-role">Role</label>
            <select id="nu-role" name="role" className="input" defaultValue="member">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nu-password">Initial password (12+ characters)</label>
            <input id="nu-password" name="password" type="password" className="input" autoComplete="new-password" required minLength={12} />
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
