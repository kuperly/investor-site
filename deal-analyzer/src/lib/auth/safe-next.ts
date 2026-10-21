/** Where to go after sign-in: only same-app relative paths, never "//evil.com" or absolute URLs. */
export function safeNext(raw: string | null | undefined): string {
  const v = String(raw ?? '')
  return /^\/(?!\/)[\w\-./?=&%]*$/.test(v) && !v.startsWith('/login') ? v : '/'
}
