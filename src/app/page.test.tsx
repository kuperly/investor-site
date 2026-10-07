import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'
import { siteConfig } from '@/lib/site-config'
import { capabilities, strategies } from '@/lib/content'

describe('HomePage', () => {
  it('renders the positioning line as the only h1, with both hero CTAs', () => {
    render(<HomePage />)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent(siteConfig.tagline)
    expect(screen.getByRole('link', { name: 'Explore Our Approach' })).toHaveAttribute('href', '/approach')
    expect(screen.getByRole('link', { name: 'Partner With Us' })).toHaveAttribute('href', '/contact')
  })

  it('leads with the core philosophy', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', { name: "We don't buy properties. We buy opportunities." }),
    ).toBeInTheDocument()
  })

  it('renders each home section', () => {
    render(<HomePage />)
    for (const name of [
      'The Vale Forge Model',
      strategies.title,
      'The Numbers Come First.',
      'Built to Compound.',
      'Build the Next Opportunity With Us.',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    for (const item of [...capabilities, ...strategies.items]) {
      expect(screen.getByRole('heading', { level: 3, name: item.title })).toBeInTheDocument()
    }
  })

  it('makes no performance or track-record claims', () => {
    const { container } = render(<HomePage />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\d+\s?%|IRR|AUM|assets under management|testimonial|guarantee/i)
    expect(text).not.toMatch(/passive income|get rich|invest with us today|act now/i)
  })
})
