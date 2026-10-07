import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelFlywheel } from './ModelFlywheel'
import { model } from '@/lib/content'

describe('ModelFlywheel', () => {
  it('lists the full sequence for assistive tech, from Find Opportunity to Acquire Again', () => {
    render(<ModelFlywheel />)
    for (const step of model.steps) {
      expect(screen.getByText(step, { selector: 'li' })).toBeInTheDocument()
    }
  })

  it('starts on Acquire and shows the chosen stage when a visitor selects it', () => {
    render(<ModelFlywheel />)
    expect(screen.getByRole('button', { name: 'Acquire' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Monetize' }))
    expect(screen.getByRole('button', { name: 'Monetize' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Acquire' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(model.cycle[2].line)).toBeInTheDocument()
  })

  it('reads "Acquire Again" once the loop comes back around', () => {
    render(<ModelFlywheel />)
    fireEvent.click(screen.getByRole('button', { name: 'Recycle Capital' }))
    fireEvent.click(screen.getByRole('button', { name: 'Acquire' }))
    expect(screen.getByText('Acquire Again', { selector: 'p' })).toBeInTheDocument()
  })
})
