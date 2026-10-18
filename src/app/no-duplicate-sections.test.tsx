import { describe, it, expect, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import HomePage from './page'
import ApproachPage from './approach/page'
import StrategiesPage from './strategies/page'
import AboutPage from './about/page'
import ContactPage from './contact/page'

vi.stubGlobal('fetch', vi.fn())

/** Section headings on a page (h1/h2), excluding the shared one-line closing CTA. */
function headings(Page: () => JSX.Element) {
  const { container } = render(<Page />)
  const found = Array.from(container.querySelectorAll('h1, h2'))
    .filter((h) => h.id !== 'closing-title')
    .map((h) => (h.textContent ?? '').trim())
  cleanup()
  return found
}

describe('each topic lives on exactly one page', () => {
  it('no section heading appears on more than one page', () => {
    const pages = { HomePage, ApproachPage, StrategiesPage, AboutPage, ContactPage }
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    for (const [name, Page] of Object.entries(pages)) {
      for (const heading of headings(Page)) {
        const first = seen.get(heading)
        if (first) duplicates.push(`"${heading}" on ${first} and ${name}`)
        else seen.set(heading, name)
      }
    }
    expect(duplicates).toEqual([])
  })
})
