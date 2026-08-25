import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Header } from './Header'
import { siteConfig } from '@/lib/site-config'

describe('Header', () => {
  it('renders the brand name and all nav links', () => {
    render(<Header />)
    expect(screen.getByRole('banner')).toHaveTextContent(siteConfig.name)
    for (const item of siteConfig.nav) {
      expect(screen.getAllByRole('link', { name: item.label }).length).toBeGreaterThan(0)
    }
  })

  it('opens the mobile drawer via the hamburger trigger and closes it via the close button', () => {
    render(<Header />)
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' })
    const closeButton = within(dialog).getByRole('button', { name: 'Close menu' })
    fireEvent.click(closeButton)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the drawer when Escape is pressed', () => {
    render(<Header />)
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the drawer when the scrim is clicked', () => {
    render(<Header />)
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByTestId('mobile-nav-scrim'))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('moves focus into the drawer on open and back to the trigger on close', () => {
    render(<Header />)
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    fireEvent.click(trigger)

    const closeButton = screen.getByRole('button', { name: 'Close menu' })
    expect(closeButton).toHaveFocus()

    fireEvent.click(closeButton)
    expect(trigger).toHaveFocus()
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
