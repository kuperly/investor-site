// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}))

const validPayload = {
  intent: 'capital',
  name: 'Jamie Rivera',
  email: 'jamie@example.com',
  message: 'We are a lender interested in partnering on future acquisitions.',
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    sendMock.mockReset()
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('CONTACT_FROM_EMAIL', 'site@example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 400 for an invalid payload', async () => {
    const { POST } = await import('./route')
    const response = await POST(makeRequest({ ...validPayload, email: 'not-an-email' }))
    expect(response.status).toBe(400)
  })

  it('returns 503 when email env vars are not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const { POST } = await import('./route')
    const response = await POST(makeRequest(validPayload))
    expect(response.status).toBe(503)
  })

  it('sends the email and returns 200 for a valid, configured request', async () => {
    sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null })
    const { POST } = await import('./route')
    const response = await POST(makeRequest(validPayload))

    expect(response.status).toBe(200)
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'investment@valeforgecapital.com',
        from: 'site@example.com',
        replyTo: 'jamie@example.com',
      }),
    )
  })

  it.each([
    ['property', 'deals@valeforgecapital.com'],
    ['operating', 'deals@valeforgecapital.com'],
    ['capital', 'investment@valeforgecapital.com'],
    ['financing', 'investment@valeforgecapital.com'],
    ['general', 'investment@valeforgecapital.com'],
  ])('routes a %s inquiry to %s', async (intent, inbox) => {
    sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null })
    const { POST } = await import('./route')
    await POST(makeRequest({ ...validPayload, intent }))
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: inbox }))
  })

  it('returns 503 when the sender address is not configured', async () => {
    vi.stubEnv('CONTACT_FROM_EMAIL', '')
    const { POST } = await import('./route')
    const response = await POST(makeRequest(validPayload))
    expect(response.status).toBe(503)
  })

  it('returns 502 when Resend reports a send error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { POST } = await import('./route')
    const response = await POST(makeRequest(validPayload))
    expect(response.status).toBe(502)
  })
})
