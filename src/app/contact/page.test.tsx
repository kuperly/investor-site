import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContactPage from './page'

describe('ContactPage', () => {
  it('renders the heading and the contact form fields', () => {
    render(<ContactPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Let's talk")
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
  })
})
