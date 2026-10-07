import { describe, it, expect } from 'vitest'
import { contactFormSchema, contactIntents } from './contact-schema'

const validPayload = {
  intent: 'property' as const,
  name: 'Jamie Rivera',
  email: 'jamie@example.com',
  message: 'I have a property opportunity to discuss.',
}

describe('contactFormSchema', () => {
  it('accepts a valid payload', () => {
    const result = contactFormSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('accepts every contact category', () => {
    for (const intent of contactIntents) {
      expect(contactFormSchema.safeParse({ ...validPayload, intent }).success).toBe(true)
    }
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

  it('rejects a payload with a non-empty honeypot field', () => {
    const result = contactFormSchema.safeParse({ ...validPayload, honeypot: 'im a bot' })
    expect(result.success).toBe(false)
  })

  it('accepts a payload with an omitted or empty honeypot field', () => {
    expect(contactFormSchema.safeParse(validPayload).success).toBe(true)
    expect(contactFormSchema.safeParse({ ...validPayload, honeypot: '' }).success).toBe(true)
  })
})
