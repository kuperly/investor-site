import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'
import { siteConfig } from '@/lib/site-config'

describe('HomePage', () => {
  it('renders the tagline as the h1 and both primary CTAs', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(siteConfig.tagline)
    expect(screen.getByRole('link', { name: 'See our approach' })).toHaveAttribute('href', '/approach')
    expect(screen.getAllByRole('link', { name: 'Get in touch' })[0]).toHaveAttribute('href', '/contact')
  })

  it('renders the three strategy pillars', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { name: 'Buy-and-hold appreciation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Disciplined flips' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: `Focused on ${siteConfig.marketFocus}` }),
    ).toBeInTheDocument()
  })

  it('renders the audiences the firm works with', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { name: 'Investors' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Wholesalers & sellers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Real estate professionals' })).toBeInTheDocument()
  })
})
