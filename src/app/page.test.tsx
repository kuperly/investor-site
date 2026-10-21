import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'
import { siteConfig } from '@/lib/site-config'
import { activeMarket } from '@/lib/market'
import { hero, philosophy } from '@/lib/content'

describe('HomePage', () => {
  it('renders the positioning line as the only h1, with a single hero CTA', () => {
    render(<HomePage />)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent(siteConfig.tagline)
    expect(screen.getByRole('link', { name: 'Explore Our Approach' })).toHaveAttribute('href', '/approach')
  })

  it('leads with the core philosophy and the misalignment thesis behind it', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', { name: "We don't buy properties. We buy opportunities." }),
    ).toBeInTheDocument()
    expect(screen.getByText('We look for misalignment.')).toBeInTheDocument()
  })

  it('introduces the company in the hero as ValeForge', () => {
    render(<HomePage />)
    expect(screen.getByText(hero.lead)).toBeInTheDocument()
  })

  it('shows the active market with its photography', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 2, name: activeMarket.title })).toBeInTheDocument()
    for (const photo of Object.values(activeMarket.photos)) {
      expect(screen.getByAltText(photo.alt)).toBeInTheDocument()
    }
  })

  it('spells the brand consistently as one word', () => {
    const { container } = render(<HomePage />)
    expect(container.textContent).not.toMatch(/Vale Forge/)
  })

  it('is a short overview: philosophy, market, partnership — nothing else', () => {
    render(<HomePage />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      philosophy.lines.join(''),
      activeMarket.title,
      'Build the Next Opportunity With Us.',
    ])
  })

  it('makes no performance or track-record claims', () => {
    const { container } = render(<HomePage />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\d+\s?%|IRR|AUM|assets under management|testimonial|guarantee/i)
    expect(text).not.toMatch(/passive income|get rich|invest with us today|act now/i)
  })
})
