/**
 * Who is signed in. Every page and server action calls requireUser() / requireAdmin():
 * middleware only checks the cookie's signature, this also checks the account is still
 * active and the session wasn't revoked (session_version).
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authDisabled, SESSION_COOKIE, SESSION_TTL_MS, sessionSecret, signSession, verifySession } from './auth/token'
import { BASE_PATH } from './base-path'
import { getDb } from './db'
import { OPEN_ACCESS_USER, type SessionUser } from './users'
import { usersRepo, type UserRecord } from './users-repo'

export async function currentUser(): Promise<SessionUser | null> {
  if (authDisabled()) return OPEN_ACCESS_USER
  const secret = sessionSecret()
  if (!secret) return null
  const payload = await verifySession((await cookies()).get(SESSION_COOKIE)?.value, secret, Date.now())
  if (!payload) return null
  const u = await usersRepo(await getDb()).get(payload.uid)
  if (!u || !u.active || u.sessionVersion !== payload.sv) return null
  return { id: u.id, username: u.username, displayName: u.displayName, role: u.role }
}

/** For pages: redirects to /login when nobody (valid) is signed in. */
export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser()
  if (!u) redirect('/login')
  return u
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser()
  if (u.role !== 'admin') redirect('/')
  return u
}

export async function startSession(u: UserRecord): Promise<void> {
  const secret = sessionSecret()
  if (!secret) throw new Error('SESSION_SECRET is not set')
  const token = await signSession({ uid: u.id, sv: u.sessionVersion, exp: Date.now() + SESSION_TTL_MS }, secret)
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: BASE_PATH || '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function endSession(): Promise<void> {
  ;(await cookies()).set(SESSION_COOKIE, '', { path: BASE_PATH || '/', maxAge: 0 })
}

/** For server actions: the name recorded in audit trails, or null when nobody is signed in. */
export async function currentActor(): Promise<string | null> {
  return (await currentUser())?.displayName ?? null
}
