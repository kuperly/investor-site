import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from './page'
import { siteConfig } from '@/lib/site-config'

describe('HomePage', () => {
  it('renders the tagline as the h1 and both primary CTAs', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(siteConfig.tagline)
    expect(screen.getByRole('link', { name: 'See our approach' })).toHaveAttribute('href', '/approach')
    expect(screen.getByRole('link', { name: 'Get in touch' })).toHaveAttribute('href', '/contact')
  })

  it('renders three pillar headings', () => {
    render(<HomePage />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3)
  })
})
