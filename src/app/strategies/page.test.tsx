import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StrategiesPage from './page'
import { strategies } from '@/lib/content'

describe('StrategiesPage', () => {
  it('renders the title as h1 and all six strategies framed as a toolkit', () => {
    render(<StrategiesPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(strategies.title)
    for (const item of strategies.items) {
      expect(screen.getByRole('heading', { level: 3, name: item.title })).toBeInTheDocument()
    }
    expect(screen.getByText(/not a claim of past transactions/)).toBeInTheDocument()
  })
})
