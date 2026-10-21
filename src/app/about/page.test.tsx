import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutPage from './page'
import { about } from '@/lib/content'

describe('AboutPage', () => {
  it('renders "Built to Compound." and the company principles', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Built to Compound.')
    expect(screen.getByRole('heading', { level: 2, name: 'How We Invest' })).toBeInTheDocument()
    expect(about.principles.map((p) => p.title)).toContain('Capital efficiency')
    for (const principle of about.principles) {
      expect(screen.getByRole('heading', { level: 3, name: principle.title })).toBeInTheDocument()
    }
  })
})
