import { describe, it, expect } from 'vitest'
import { contactFormSchema } from './contact-schema'

const validPayload = {
  intent: 'investor' as const,
  name: 'Jamie Rivera',
  email: 'jamie@example.com',
  message: 'I would like to learn more about your fund.',
}

describe('contactFormSchema', () => {
  it('accepts a valid payload', () => {
    const result = contactFormSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('rejects an invalid intent', () => {
    const result = contactFormSchema.safeParse({ ...validPayload, intent: 'other' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing name', () => {
    const result = contactFormSchema.safeParse({ ...validPayload, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = contactFormSchema.safeParse({ ...validPayload, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects a too-short message', () => {
    const result = contactFormSchema.safeParse({ ...validPayload, message: 'hi' })
    expect(result.success).toBe(false)
  })
})
