import { describe, it, expect } from 'vitest'
import { siteConfig } from './site-config'

describe('siteConfig', () => {
  it('has a non-empty placeholder name and tagline', () => {
    expect(siteConfig.name.length).toBeGreaterThan(0)
    expect(siteConfig.tagline.length).toBeGreaterThan(0)
  })

  it('exposes exactly the four primary nav items with unique hrefs', () => {
    expect(siteConfig.nav).toHaveLength(4)
    const hrefs = siteConfig.nav.map((item) => item.href)
    expect(new Set(hrefs).size).toBe(4)
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/approach', '/about', '/contact']))
  })

  it('has a plausible contact email', () => {
    expect(siteConfig.contactEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  })
})
