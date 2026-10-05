import { describe, expect, it } from 'vitest'
import { resolveBasePath } from './base-path'

describe('resolveBasePath', () => {
  it('empty or "/" → served at root', () => {
    expect(resolveBasePath(undefined)).toBe('')
    expect(resolveBasePath('')).toBe('')
    expect(resolveBasePath('/')).toBe('')
  })
  it('accepts a single path segment', () => {
    expect(resolveBasePath('/vf-internal')).toBe('/vf-internal')
    expect(resolveBasePath(' /Deals2 ')).toBe('/Deals2')
  })
  it('rejects anything else (fails the build instead of serving at a wrong path)', () => {
    for (const bad of ['vf', '/vf/', '/a/b', '/vf internal', '/../x', 'https://x']) {
      expect(() => resolveBasePath(bad)).toThrow(/ANALYZER_BASE_PATH/)
    }
  })
})
