import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Reveal } from './Reveal'

describe('Reveal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders its children', () => {
    render(
      <Reveal>
        <p>Hello</p>
      </Reveal>,
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('starts hidden and respects prefers-reduced-motion by showing content immediately', () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string): MediaQueryList =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    )

    const { container } = render(
      <Reveal>
        <p>Hello</p>
      </Reveal>,
    )

    expect(container.firstChild).toHaveClass('opacity-100')
    expect(container.firstChild).not.toHaveClass('opacity-0')
  })

  it('stays hidden until the intersection observer reports visibility', () => {
    const { container } = render(
      <Reveal>
        <p>Hello</p>
      </Reveal>,
    )

    expect(container.firstChild).toHaveClass('opacity-0')
  })
})
