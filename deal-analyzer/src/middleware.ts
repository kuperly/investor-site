import { NextResponse, type NextRequest } from 'next/server'

/**
 * Site-wide Basic Auth (internal tool); covers every path.
 * FAIL-CLOSED: in production, if BASIC_AUTH_USER / BASIC_AUTH_PASSWORD are missing,
 * every request gets 503 — a fresh deployment is never publicly open while its
 * password is still unset. AUTH_DISABLED=1 opts out explicitly (local prod runs / E2E only).
 */
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const pass = process.env.BASIC_AUTH_PASSWORD
  if (!user || !pass) {
    if (process.env.NODE_ENV !== 'production' || process.env.AUTH_DISABLED === '1') return NextResponse.next()
    return new NextResponse('Access is not configured: set BASIC_AUTH_USER and BASIC_AUTH_PASSWORD.', { status: 503 })
  }
  const header = req.headers.get('authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme === 'Basic' && encoded) {
    let decoded = ''
    try {
      decoded = atob(encoded)
    } catch {
      decoded = ''
    }
    const [u, ...rest] = decoded.split(':')
    if (u === user && rest.join(':') === pass) return NextResponse.next()
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="ValeForge"' },
  })
}

// No `matcher` on purpose: with a basePath, a matcher like "/((?!_next/static).*)"
// is prefixed to "/<basePath>/…" and silently skips the bare "/<basePath>" — which
// is the dashboard. Protect every request instead (browsers resend Basic Auth
// credentials for static assets automatically). Guarded by e2e/auth-check.sh.
