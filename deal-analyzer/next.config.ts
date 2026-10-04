import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // This app lives inside the marketing-site repo; pin the tracing root so Next
  // doesn't pick the parent lockfile as the workspace root.
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  outputFileTracingIncludes: { '/**': ['./db/schema.sql'] },
}

export default nextConfig
