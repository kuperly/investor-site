/** §2 MVP users. No permission system yet — the selected name is recorded on every change. */
export const USERS = ['Guy', 'Ben'] as const
export type User = (typeof USERS)[number]
export const USER_COOKIE = 'vf_user'

export function asUser(v: string | undefined | null): User | null {
  return (USERS as readonly string[]).includes(v ?? '') ? (v as User) : null
}
