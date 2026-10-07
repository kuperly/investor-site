import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Footer } from './Footer'
import { siteConfig } from '@/lib/site-config'

describe('Footer', () => {
  it('renders the brand and positioning line', () => {
    render(<Footer />)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent(siteConfig.name)
    expect(footer).toHaveTextContent(siteConfig.tagline)
  })

  it('links to every section page except Home', () => {
    render(<Footer />)
    const nav = screen.getByRole('navigation', { name: 'Footer' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Approach',
      'Strategies',
      'About',
      'Contact',
    ])
  })

  it('links to the legal pages', () => {
    render(<Footer />)
    const nav = screen.getByRole('navigation', { name: 'Legal' })
    for (const item of siteConfig.legal) {
      expect(within(nav).getByRole('link', { name: item.label })).toHaveAttribute('href', item.href)
    }
  })

  it('states that the site is not a solicitation', () => {
    render(<Footer />)
    expect(screen.getByText(/not an offer to sell/)).toBeInTheDocument()
  })
})
