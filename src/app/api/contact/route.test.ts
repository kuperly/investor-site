// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}))

const validPayload = {
  intent: 'investor',
  name: 'Jamie Rivera',
  email: 'jamie@example.com',
  message: 'I would like to learn more about your fund.',
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
    vi.stubEnv('CONTACT_TO_EMAIL', 'founder@example.com')
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
        to: 'founder@example.com',
        from: 'site@example.com',
        replyTo: 'jamie@example.com',
      }),
    )
  })

  it('returns 502 when Resend reports a send error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { POST } = await import('./route')
    const response = await POST(makeRequest(validPayload))
    expect(response.status).toBe(502)
  })
})
