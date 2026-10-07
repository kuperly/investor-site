import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import HomePage from './page'
import ApproachPage from './approach/page'
import AboutPage from './about/page'
import ContactPage from './contact/page'
import StrategiesPage from './strategies/page'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

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

  it('strategies page has no axe violations', async () => {
    const { container } = render(<StrategiesPage />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('header and footer have no axe violations', async () => {
    const { container } = render(
      <>
        <Header />
        <Footer />
      </>,
    )
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
