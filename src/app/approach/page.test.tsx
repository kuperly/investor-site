import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApproachPage from './page'

describe('ApproachPage', () => {
  it('renders the page heading and all four criteria headings', () => {
    render(<ApproachPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('How we evaluate every deal')
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4)
  })
})
