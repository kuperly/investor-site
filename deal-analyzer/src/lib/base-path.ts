/**
 * Optional sub-path the analyzer is served under, e.g. "/vf-internal", so the
 * investor website can expose it as a hidden route by rewriting
 * yoursite.com/vf-internal/* to this app's deployment. Empty = served at "/".
 * Read at build time (Next's basePath is fixed per build).
 */
export function resolveBasePath(raw: string | undefined): string {
  const v = (raw ?? '').trim()
  if (v === '' || v === '/') return ''
  if (!/^\/[a-z0-9][a-z0-9-]*$/i.test(v)) {
    throw new Error(`ANALYZER_BASE_PATH must look like "/vf-internal" (got "${v}")`)
  }
  return v
}

export const BASE_PATH = resolveBasePath(process.env.ANALYZER_BASE_PATH)
