import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContactPage from './page'
import { contactIntentOptions } from '@/lib/contact-schema'

describe('ContactPage', () => {
  it('renders the heading, every inquiry category and the contact form fields', () => {
    render(<ContactPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Let's Talk About the Opportunity.")
    for (const option of contactIntentOptions) {
      expect(screen.getByRole('radio', { name: option.label })).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
  })

  it('lists both inboxes as mailto links', () => {
    render(<ContactPage />)
    for (const email of ['investment@valeforgecapital.com', 'deals@valeforgecapital.com']) {
      expect(screen.getByRole('link', { name: email })).toHaveAttribute('href', `mailto:${email}`)
    }
  })
})
