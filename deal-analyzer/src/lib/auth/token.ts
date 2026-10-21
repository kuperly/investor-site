/**
 * Signed session token: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 * Web Crypto only, so the same code runs in middleware (edge) and on the server.
 * The token proves who signed in; the server still checks the user is active and that
 * session_version still matches (disable / password change signs out everywhere).
 */
export interface SessionPayload {
  /** user id */
  uid: string
  /** users.session_version at sign-in */
  sv: number
  /** expiry, ms since epoch */
  exp: number
}

export const SESSION_COOKIE = 'vf_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

const enc = new TextEncoder()

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

export async function signSession(p: SessionPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(p)))
  return `${body}.${b64url(await hmac(secret, body))}`
}

export async function verifySession(token: string | undefined, secret: string, nowMs: number): Promise<SessionPayload | null> {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  let given: Uint8Array
  try {
    given = fromB64url(sig)
  } catch {
    return null
  }
  const expected = await hmac(secret, body)
  if (given.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < given.length; i++) diff |= given[i] ^ expected[i]
  if (diff !== 0) return null
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload
    if (typeof p.uid !== 'string' || typeof p.sv !== 'number' || typeof p.exp !== 'number') return null
    return p.exp > nowMs ? p : null
  } catch {
    return null
  }
}

/** Dev/test only. Production refuses to run without SESSION_SECRET (see sessionSecret()). */
const DEV_SECRET = 'vf-dev-only-session-secret-do-not-use-in-production'

export function sessionSecret(env: Record<string, string | undefined> = process.env): string | null {
  const s = env.SESSION_SECRET
  if (s && s.length >= 32) return s
  return env.NODE_ENV === 'production' ? null : DEV_SECRET
}

export const authDisabled = (env: Record<string, string | undefined> = process.env) => env.AUTH_DISABLED === '1'
