import { describe, expect, it } from 'vitest'
import { analyzerRewrites } from '../../next.config'

describe('hidden analyzer route (next.config rewrites)', () => {
  it('is inert unless both env vars are set', () => {
    expect(analyzerRewrites({})).toEqual([])
    expect(analyzerRewrites({ ANALYZER_URL: 'https://a.vercel.app' })).toEqual([])
    expect(analyzerRewrites({ ANALYZER_BASE_PATH: '/vf-internal' })).toEqual([])
  })
  it('proxies the base path and everything under it', () => {
    expect(analyzerRewrites({ ANALYZER_URL: 'https://a.vercel.app/', ANALYZER_BASE_PATH: '/vf-internal' })).toEqual([
      { source: '/vf-internal', destination: 'https://a.vercel.app/vf-internal' },
      { source: '/vf-internal/:path*', destination: 'https://a.vercel.app/vf-internal/:path*' },
    ])
  })
  it('rejects malformed values instead of proxying somewhere unexpected', () => {
    expect(() => analyzerRewrites({ ANALYZER_URL: 'https://a.vercel.app/x', ANALYZER_BASE_PATH: '/vf' })).toThrow()
    expect(() => analyzerRewrites({ ANALYZER_URL: 'a.vercel.app', ANALYZER_BASE_PATH: '/vf' })).toThrow()
    expect(() => analyzerRewrites({ ANALYZER_URL: 'https://a.vercel.app', ANALYZER_BASE_PATH: '/' })).toThrow()
    expect(() => analyzerRewrites({ ANALYZER_URL: 'https://a.vercel.app', ANALYZER_BASE_PATH: '/a/b' })).toThrow()
  })
})
