/**
 * Users (spec VF-03 §22): real accounts in the `users` table, signed-in through /login.
 * `User` is the name recorded in audit trails (the user's display name).
 */
export type User = string

export const ROLES = ['admin', 'member'] as const
export type Role = (typeof ROLES)[number]

export interface SessionUser {
  id: string
  username: string
  displayName: string
  role: Role
  /** True only in open-access mode (AUTH_DISABLED=1): nobody is signed in. */
  openAccess?: boolean
}

/** AUTH_DISABLED=1: everyone may use the app; changes are attributed to this name. Never an admin. */
export const OPEN_ACCESS_USER: SessionUser = {
  id: 'open-access',
  username: 'open-access',
  displayName: 'Open access (login off)',
  role: 'member',
  openAccess: true,
}

export const USERNAME_RE = /^[a-z0-9._-]{2,32}$/
