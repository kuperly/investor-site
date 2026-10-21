import { describe, expect, it } from 'vitest'
import { ANALYZER_BASE_PATH, analyzerRewrites, DEFAULT_ANALYZER_URL } from '../../next.config'

describe('hidden analyzer route (next.config rewrites)', () => {
  it('serves the analyzer at /apps (fixed in code) on its Railway deployment by default', () => {
    expect(ANALYZER_BASE_PATH).toBe('/apps')
    expect(analyzerRewrites({})).toEqual([
      { source: '/apps', destination: `${DEFAULT_ANALYZER_URL}/apps` },
      { source: '/apps/:path*', destination: `${DEFAULT_ANALYZER_URL}/apps/:path*` },
    ])
    expect(analyzerRewrites({ ANALYZER_URL: '  ' })).toEqual(analyzerRewrites({}))
  })
  it('ANALYZER_URL overrides the target (trailing slash ignored) and "off" disables the route', () => {
    expect(analyzerRewrites({ ANALYZER_URL: 'https://a.example.com/' })).toEqual([
      { source: '/apps', destination: 'https://a.example.com/apps' },
      { source: '/apps/:path*', destination: 'https://a.example.com/apps/:path*' },
    ])
    expect(analyzerRewrites({ ANALYZER_URL: 'off' })).toEqual([])
    expect(analyzerRewrites({ ANALYZER_URL: 'OFF' })).toEqual([])
  })
  it('rejects a malformed ANALYZER_URL instead of proxying somewhere unexpected', () => {
    expect(() => analyzerRewrites({ ANALYZER_URL: 'https://a.example.com/x' })).toThrow()
    expect(() => analyzerRewrites({ ANALYZER_URL: 'a.example.com' })).toThrow()
  })
})
