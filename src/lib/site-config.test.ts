import { describe, it, expect } from 'vitest'
import { siteConfig } from './site-config'

describe('siteConfig', () => {
  it('has the brand name and positioning line', () => {
    expect(siteConfig.name).toBe('Vale Forge Capital')
    expect(siteConfig.tagline).toBe('Building Value from Opportunity.')
  })

  it('exposes exactly the five primary nav items with unique hrefs', () => {
    const hrefs = siteConfig.nav.map((item) => item.href)
    expect(hrefs).toEqual(['/', '/approach', '/strategies', '/about', '/contact'])
  })

  it('has a plausible contact email', () => {
    expect(siteConfig.contactEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  })
})
