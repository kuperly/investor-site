'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { bootstrapAdmin } from '@/lib/auth/bootstrap'
import { passwordProblem } from '@/lib/auth/password'
import { safeNext } from '@/lib/auth/safe-next'
import { clearFailures, isLocked, recordFailure } from '@/lib/auth/throttle'
import { authDisabled, sessionSecret } from '@/lib/auth/token'
import { getDb } from '@/lib/db'
import { currentUser, endSession, requireAdmin, startSession } from '@/lib/session'
import { ROLES, USERNAME_RE, type Role } from '@/lib/users'
import { usersRepo } from '@/lib/users-repo'

export interface FormState {
  ok?: string
  error?: string
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState & { username?: string }> {
  if (authDisabled()) redirect('/')
  if (!sessionSecret()) return { error: 'Sign-in is not configured on this server (SESSION_SECRET).' }
  const username = String(formData.get('username') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const keys = [`u:${username}`, `ip:${ip}`]
  if (isLocked(keys)) return { error: 'Too many failed attempts. Wait 15 minutes and try again.', username }

  const db = await getDb()
  await bootstrapAdmin(db)
  const user = username && password ? await usersRepo(db).authenticate(username, password) : null
  if (!user) {
    recordFailure(keys)
    return { error: 'Wrong username or password.', username }
  }
  clearFailures(keys)
  await startSession(user)
  redirect(safeNext(formData.get('next') as string | null))
}

export async function signOut(): Promise<void> {
  await endSession()
  redirect('/login')
}

export async function changeOwnPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await currentUser()
  if (!me || me.openAccess) return { error: 'Sign in first.' }
  const current = String(formData.get('current') ?? '')
  const next = String(formData.get('next') ?? '')
  if (next !== String(formData.get('confirm') ?? '')) return { error: 'The new passwords do not match.' }
  const problem = passwordProblem(next)
  if (problem) return { error: problem }
  const repo = usersRepo(await getDb())
  if (!(await repo.authenticate(me.username, current))) return { error: 'Your current password is wrong.' }
  await repo.setPassword(me.id, next, me.displayName)
  const fresh = await repo.get(me.id)
  if (fresh) await startSession(fresh) // this browser stays signed in, every other session ends
  return { ok: 'Password changed. Other devices have been signed out.' }
}

export async function signOutEverywhere(): Promise<void> {
  const me = await currentUser()
  if (!me || me.openAccess) redirect('/login')
  await usersRepo(await getDb()).signOutEverywhere(me.id, me.displayName)
  await endSession()
  redirect('/login')
}

// ---- Admin: user management ----

const readRole = (v: FormDataEntryValue | null): Role => ((ROLES as readonly string[]).includes(String(v)) ? (v as Role) : 'member')

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const username = String(formData.get('username') ?? '').trim().toLowerCase()
  const displayName = String(formData.get('displayName') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!USERNAME_RE.test(username)) return { error: 'Username: 2–32 characters, lowercase letters, digits, ".", "_" or "-".' }
  if (!displayName || displayName.length > 40) return { error: 'Display name: 1–40 characters.' }
  const problem = passwordProblem(password)
  if (problem) return { error: `Password: ${problem}` }
  try {
    await usersRepo(await getDb()).create({ username, displayName, role: readRole(formData.get('role')), password }, admin.displayName)
  } catch {
    return { error: 'That username or display name is already taken.' }
  }
  revalidatePath('/admin/users')
  return { ok: `Created ${displayName}. Give them the password privately; they can change it on their Account page.` }
}

export async function resetUserPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const password = String(formData.get('password') ?? '')
  const problem = passwordProblem(password)
  if (problem) return { error: `Password: ${problem}` }
  const repo = usersRepo(await getDb())
  if (!(await repo.get(id))) return { error: 'User not found.' }
  await repo.setPassword(id, password, admin.displayName)
  revalidatePath('/admin/users')
  return { ok: 'Password reset. That user has been signed out everywhere.' }
}

export async function updateUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === 'on'
  if (id === admin.id && !active) return { error: 'You cannot deactivate your own account.' }
  try {
    await usersRepo(await getDb()).update(id, { role: readRole(formData.get('role')), active }, admin.displayName)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Update failed.' }
  }
  revalidatePath('/admin/users')
  return { ok: 'Saved.' }
}
