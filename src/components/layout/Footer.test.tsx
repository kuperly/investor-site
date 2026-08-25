import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from './Footer'
import { siteConfig } from '@/lib/site-config'

describe('Footer', () => {
  it('renders brand name, market focus, and a contact link', () => {
    render(<Footer />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(siteConfig.name)
    expect(screen.getByText(siteConfig.marketFocus)).toBeInTheDocument()
    const contactLink = screen.getByRole('link', { name: 'Contact' })
    expect(contactLink).toHaveAttribute('href', '/contact')
  })

  it('does not duplicate the header navigation', () => {
    render(<Footer />)
    // Footer is intentionally minimal on a 4-page site — nav lives only in the header.
    expect(screen.queryByRole('link', { name: 'Approach' })).not.toBeInTheDocument()
  })
})
