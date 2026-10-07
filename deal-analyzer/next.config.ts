import type { NextConfig } from 'next'
import { BASE_PATH } from './src/lib/base-path'

const nextConfig: NextConfig = {
  // Set ANALYZER_BASE_PATH (e.g. "/vf-internal") when the investor website exposes
  // this app as a hidden route via a rewrite. Unset = served at "/".
  basePath: BASE_PATH,
  // This app lives inside the marketing-site repo; pin the tracing root so Next
  // doesn't pick the parent lockfile as the workspace root.
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  outputFileTracingIncludes: { '/**': ['./db/migrations/**'] },
  // Internal tool: keep it out of search engines even if a URL leaks.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
  },
}

export default nextConfig
