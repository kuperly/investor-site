/**
 * First admin: when the users table is empty and ADMIN_USERNAME + ADMIN_PASSWORD are set
 * (deployment environment, never in code), that account is created on the first sign-in
 * attempt. After that the env values are ignored: manage users on /admin/users.
 */
import type { Db } from '../db'
import { USERNAME_RE } from '../users'
import { usersRepo } from '../users-repo'
import { passwordProblem } from './password'

export async function bootstrapAdmin(db: Db, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const repo = usersRepo(db)
  if ((await repo.count()) > 0) return false
  const username = (env.ADMIN_USERNAME ?? '').trim().toLowerCase()
  const password = env.ADMIN_PASSWORD ?? ''
  if (!USERNAME_RE.test(username) || passwordProblem(password)) return false
  const displayName = (env.ADMIN_DISPLAY_NAME ?? '').trim() || username
  try {
    await repo.create({ username, displayName, role: 'admin', password }, 'system (ADMIN_USERNAME)')
  } catch {
    // A concurrent first sign-in created it already (unique username).
  }
  return true
}
