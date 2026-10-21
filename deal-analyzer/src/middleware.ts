import { NextResponse, type NextRequest } from 'next/server'
import { authDisabled, SESSION_COOKIE, sessionSecret, verifySession } from '@/lib/auth/token'
import { BASE_PATH } from '@/lib/base-path'

/**
 * Sign-in gate for every path (spec VF-03 §22: real authenticated users).
 *  - A valid signed session cookie → through. Pages and actions then re-check the account
 *    (active, not signed out) with requireUser(); this layer only checks the signature.
 *  - No session: page requests are redirected to /login; anything else gets 401.
 * FAIL-CLOSED: in production without SESSION_SECRET (≥ 32 chars) every request gets 503.
 * AUTH_DISABLED=1 is open-access mode (owner's explicit decision; local E2E runs).
 */
const PUBLIC = [/^\/login\/?$/, /^\/_next\/static\//, /^\/_next\/image/, /^\/favicon\.ico$/]

export async function middleware(req: NextRequest) {
  if (authDisabled()) return NextResponse.next()
  const secret = sessionSecret()
  if (!secret) return new NextResponse('Sign-in is not configured: set SESSION_SECRET (32+ characters).', { status: 503 })

  let path = req.nextUrl.pathname
  if (BASE_PATH && (path === BASE_PATH || path.startsWith(BASE_PATH + '/'))) path = path.slice(BASE_PATH.length) || '/'
  if (PUBLIC.some((re) => re.test(path))) return NextResponse.next()

  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret, Date.now())) return NextResponse.next()

  const isPage = (req.method === 'GET' || req.method === 'HEAD') && !req.headers.get('next-action')
  if (!isPage) return new NextResponse('Sign in required', { status: 401 })
  const url = req.nextUrl.clone()
  url.pathname = '/login' // NextURL re-adds the basePath
  url.search = path === '/' ? '' : `?next=${encodeURIComponent(path + req.nextUrl.search)}`
  return NextResponse.redirect(url)
}

// No `matcher` on purpose: with a basePath, a matcher like "/((?!_next/static).*)"
// is prefixed to "/<basePath>/…" and silently skipped the bare "/<basePath>" (the
// dashboard). Every request runs through here; public paths are listed above.
// Guarded by e2e/auth-check.sh.
