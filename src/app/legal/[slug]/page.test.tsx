import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import LegalPage, { generateMetadata } from './page'
import { legalDocuments } from '@/lib/legal'
import { siteConfig } from '@/lib/site-config'

expect.extend(toHaveNoViolations)

async function renderLegal(slug: string) {
  return render(await LegalPage({ params: Promise.resolve({ slug }) }))
}

describe('Legal pages', () => {
  for (const [slug, document] of Object.entries(legalDocuments)) {
    it(`renders the ${document.title} with every section and a contact link`, async () => {
      const { container } = await renderLegal(slug)
      expect(screen.getByRole('heading', { level: 1, name: document.title })).toBeInTheDocument()
      for (const section of document.sections) {
        expect(screen.getByRole('heading', { level: 2, name: section.heading })).toBeInTheDocument()
      }
      expect(screen.getAllByRole('link', { name: siteConfig.emails.investment })[0]).toHaveAttribute(
        'href',
        `mailto:${siteConfig.emails.investment}`,
      )
      expect(container.textContent).not.toMatch(/\{email\}|being prepared|Vale Forge/)
      expect(await axe(container)).toHaveNoViolations()
    })
  }

  it('stays out of search results until counsel has reviewed the texts', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'privacy' }) })
    expect(metadata.robots).toEqual({ index: false, follow: true })
  })

  it('makes no performance claims', () => {
    const text = JSON.stringify(legalDocuments)
    expect(text).not.toMatch(/\d+\s?%|IRR|AUM|accredited|guaranteed returns/i)
  })
})
