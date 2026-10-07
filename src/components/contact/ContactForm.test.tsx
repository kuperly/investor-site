import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ContactForm } from './ContactForm'

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jamie Rivera' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jamie@example.com' } })
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'I have a duplex that may be a good fit.' },
  })
}

describe('ContactForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows an inline error when a required field is blurred empty', () => {
    render(<ContactForm />)
    const nameInput = screen.getByLabelText('Full name')
    fireEvent.blur(nameInput)
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
  })

  it('submits the selected inquiry category', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Sent' }),
    })

    render(<ContactForm />)
    fireEvent.click(screen.getByRole('radio', { name: 'Property Opportunity' }))
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await screen.findByRole('status')
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.intent).toBe('property')
  })

  it('disables the submit button while submitting', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    render(<ContactForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
    })

    resolveFetch({ ok: true, json: async () => ({ message: 'Sent' }) })
    await screen.findByRole('status')
  })

  it('shows a success message after a successful submit', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Sent' }),
    })

    render(<ContactForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/thank you/i)
  })

  it('shows an error message when the request fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'The contact form is not configured yet.' }),
    })

    render(<ContactForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('The contact form is not configured yet.')).toBeInTheDocument()
  })
})
