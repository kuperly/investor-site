import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Footer } from './Footer'
import { siteConfig } from '@/lib/site-config'

describe('Footer', () => {
  it('renders brand name, market focus, and a mailto contact link', () => {
    render(<Footer />)
    expect(screen.getByText(siteConfig.name)).toBeInTheDocument()
    expect(screen.getByText(siteConfig.marketFocus)).toBeInTheDocument()
    const contactLink = screen.getByRole('link', { name: siteConfig.contactEmail })
    expect(contactLink).toHaveAttribute('href', `mailto:${siteConfig.contactEmail}`)
  })

  it('renders all nav links', () => {
    render(<Footer />)
    for (const item of siteConfig.nav) {
      expect(screen.getByRole('link', { name: item.label })).toBeInTheDocument()
    }
  })
})
