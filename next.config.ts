import type { NextConfig } from 'next'

/**
 * Hidden route for the internal ValeForge Deal Analyzer (deal-analyzer/).
 * The analyzer is a separate app and deployment; this site only proxies
 * yoursite.com/apps/* to it. Access control (sign-in) is enforced by the
 * analyzer itself, not here.
 *
 * The path is fixed in code. It must equal the analyzer's own build-time
 * ANALYZER_BASE_PATH (set to /apps on its Railway service).
 */
export const ANALYZER_BASE_PATH = '/apps'
/** The analyzer's production deployment (Railway project `valeforge-deal-analyzer`). */
export const DEFAULT_ANALYZER_URL = 'https://deal-analyzer-production.up.railway.app'

/**
 * Rewrites for the hidden route. ANALYZER_URL (optional env) points it at another origin,
 * or "off" disables it.
 */
export function analyzerRewrites(env: Record<string, string | undefined> = process.env) {
  const raw = env.ANALYZER_URL?.trim()
  if (raw?.toLowerCase() === 'off') return []
  const url = (raw || DEFAULT_ANALYZER_URL).replace(/\/+$/, '')
  if (!/^https?:\/\/[^/\s]+$/.test(url)) throw new Error(`ANALYZER_URL must be an origin like https://app.example.com (got "${url}")`)
  const base = ANALYZER_BASE_PATH
  return [
    { source: base, destination: `${url}${base}` },
    { source: `${base}/:path*`, destination: `${url}${base}/:path*` },
  ]
}

const nextConfig: NextConfig = {
  async rewrites() {
    return analyzerRewrites()
  },
}

export default nextConfig
