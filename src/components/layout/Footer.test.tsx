import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from './Footer'
import { siteConfig } from '@/lib/site-config'

describe('Footer', () => {
  it('renders the brand name and market focus', () => {
    render(<Footer />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(siteConfig.name)
    expect(screen.getByText(siteConfig.marketFocus)).toBeInTheDocument()
  })

  it('does not duplicate header navigation or repeat the contact link', () => {
    render(<Footer />)
    // Footer is intentionally minimal on a 4-page site — nav/contact live in the header.
    expect(screen.queryByRole('link', { name: 'Approach' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Contact' })).not.toBeInTheDocument()
  })
})
