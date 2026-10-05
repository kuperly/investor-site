import { NextResponse, type NextRequest } from 'next/server'

/** Site-wide Basic Auth (internal tool). Enabled when both env vars are set; covers every path. */
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const pass = process.env.BASIC_AUTH_PASSWORD
  if (!user || !pass) return NextResponse.next()
  const header = req.headers.get('authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme === 'Basic' && encoded) {
    const [u, ...rest] = atob(encoded).split(':')
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
