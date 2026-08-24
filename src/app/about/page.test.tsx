import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutPage from './page'
import { siteConfig } from '@/lib/site-config'

describe('AboutPage', () => {
  it('renders an h1 referencing the site name and the market focus in body copy', () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(siteConfig.name)
    expect(screen.getByText(new RegExp(siteConfig.marketFocus))).toBeInTheDocument()
  })
})
