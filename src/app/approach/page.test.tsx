import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApproachPage from './page'

describe('ApproachPage', () => {
  it('renders the philosophy as h1 and the approach sections', () => {
    render(<ApproachPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "We don't buy properties. We buy opportunities.",
    )
    for (const name of ['The ValeForge Model', 'The Numbers Come First.', 'Measured by more than return.']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })
})
