import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from './Header'
import { siteConfig } from '@/lib/site-config'

describe('Header', () => {
  it('renders the brand name and all nav links', () => {
    render(<Header />)
    expect(screen.getAllByText(siteConfig.name).length).toBeGreaterThan(0)
    for (const item of siteConfig.nav) {
      expect(screen.getAllByRole('link', { name: item.label }).length).toBeGreaterThan(0)
    }
  })

  it('toggles the mobile menu open and closed', () => {
    const { container } = render(<Header />)
    const toggle = screen.getByRole('button', { name: /open menu/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('#mobile-nav')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(container.querySelector('#mobile-nav')).not.toBeNull()
  })

  it('applies a frosted background once the page is scrolled', () => {
    const { container } = render(<Header />)
    const header = container.querySelector('header')
    expect(header).toHaveClass('bg-background')
    expect(header).not.toHaveClass('backdrop-blur-md')

    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true })
    fireEvent.scroll(window)

    expect(header).toHaveClass('backdrop-blur-md')
  })
})
