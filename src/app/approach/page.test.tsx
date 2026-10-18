import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApproachPage from './page'
import { capabilities } from '@/lib/content'

describe('ApproachPage', () => {
  it('owns the model, the four steps and the underwriting/capital/exit sections', () => {
    render(<ApproachPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The ValeForge Model')
    for (const name of [
      'The Numbers Come First.',
      'Measured by more than return.',
      'The Best Opportunities Have More Than One Path.',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    for (const step of capabilities) {
      expect(screen.getByRole('heading', { level: 3, name: step.title })).toBeInTheDocument()
    }
  })
})
