import type { NextConfig } from 'next'

/**
 * Hidden route for the internal ValeForge Deal Analyzer (deal-analyzer/).
 * The analyzer is a separate app and deployment; this site only proxies
 * yoursite.com<ANALYZER_BASE_PATH>/* to it. Inert unless BOTH env vars are set:
 *   ANALYZER_URL        e.g. https://valeforge-analyzer.vercel.app (no trailing slash)
 *   ANALYZER_BASE_PATH  e.g. /vf-internal — must equal the analyzer's own ANALYZER_BASE_PATH
 * Access control (Basic Auth) is enforced by the analyzer itself, not here.
 */
export function analyzerRewrites(env: Record<string, string | undefined> = process.env) {
  const url = env.ANALYZER_URL?.trim().replace(/\/+$/, '')
  const base = env.ANALYZER_BASE_PATH?.trim()
  if (!url || !base) return []
  if (!/^https?:\/\/[^/\s]+$/.test(url)) throw new Error(`ANALYZER_URL must be an origin like https://x.vercel.app (got "${url}")`)
  if (!/^\/[a-z0-9][a-z0-9-]*$/i.test(base)) throw new Error(`ANALYZER_BASE_PATH must look like "/vf-internal" (got "${base}")`)
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
