import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import HomePage from './page'
import ApproachPage from './approach/page'
import AboutPage from './about/page'
import ContactPage from './contact/page'

expect.extend(toHaveNoViolations)
vi.stubGlobal('fetch', vi.fn())

describe('page accessibility', () => {
  it('home page has no axe violations', async () => {
    const { container } = render(<HomePage />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('approach page has no axe violations', async () => {
    const { container } = render(<ApproachPage />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('about page has no axe violations', async () => {
    const { container } = render(<AboutPage />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('contact page has no axe violations', async () => {
    const { container } = render(<ContactPage />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
