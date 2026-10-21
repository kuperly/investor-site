import { describe, expect, it } from 'vitest'
import { hashPassword, passwordProblem, verifyPassword } from './password'
import { safeNext } from './safe-next'
import { clearFailures, isLocked, MAX_FAILURES, recordFailure, WINDOW_MS } from './throttle'
import { sessionSecret, signSession, verifySession } from './token'

const SECRET = 'x'.repeat(40)

describe('passwords', () => {
  it('hashes with a random salt and verifies only the right password', async () => {
    const a = await hashPassword('correct horse battery')
    const b = await hashPassword('correct horse battery')
    expect(a).not.toBe(b)
    expect(a.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('correct horse battery', a)).toBe(true)
    expect(await verifyPassword('wrong horse battery', a)).toBe(false)
    expect(await verifyPassword('anything', 'garbage')).toBe(false)
  })
  it('requires 12+ characters', () => {
    expect(passwordProblem('short')).toMatch(/12/)
    expect(passwordProblem('twelve-chars')).toBeNull()
  })
})

describe('session tokens', () => {
  it('round-trips a signed payload until it expires', async () => {
    const t = await signSession({ uid: 'u1', sv: 3, exp: 2_000 }, SECRET)
    expect(await verifySession(t, SECRET, 1_000)).toEqual({ uid: 'u1', sv: 3, exp: 2_000 })
    expect(await verifySession(t, SECRET, 2_000)).toBeNull()
  })
  it('rejects a tampered payload, a wrong secret and junk', async () => {
    const t = await signSession({ uid: 'u1', sv: 1, exp: 9e15 }, SECRET)
    const [body, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ uid: 'admin', sv: 1, exp: 9e15 })).toString('base64url')
    expect(await verifySession(`${forged}.${sig}`, SECRET, 0)).toBeNull()
    expect(await verifySession(t, 'y'.repeat(40), 0)).toBeNull()
    expect(await verifySession(`${body}`, SECRET, 0)).toBeNull()
    expect(await verifySession('a.b.c', SECRET, 0)).toBeNull()
    expect(await verifySession(undefined, SECRET, 0)).toBeNull()
  })
  it('production refuses to run without a 32+ character SESSION_SECRET', () => {
    expect(sessionSecret({ NODE_ENV: 'production' })).toBeNull()
    expect(sessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toBeNull()
    expect(sessionSecret({ NODE_ENV: 'production', SESSION_SECRET: SECRET })).toBe(SECRET)
    expect(sessionSecret({ NODE_ENV: 'development' })).toMatch(/dev-only/)
  })
})

describe('sign-in throttle', () => {
  it(`locks after ${MAX_FAILURES} failures within the window, then frees`, () => {
    const keys = [`u:t${Date.now()}`]
    for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure(keys, 1_000)
    expect(isLocked(keys, 1_000)).toBe(false)
    recordFailure(keys, 1_000)
    expect(isLocked(keys, 1_000)).toBe(true)
    expect(isLocked(keys, 1_000 + WINDOW_MS)).toBe(false)
    clearFailures(keys)
    expect(isLocked(keys, 1_000)).toBe(false)
  })
})

describe('post-sign-in redirect', () => {
  it.each([
    ['/deals/abc', '/deals/abc'],
    ['/markets?level=msa', '/markets?level=msa'],
    ['//evil.com', '/'],
    ['https://evil.com', '/'],
    ['/login', '/'],
    ['javascript:alert(1)', '/'],
    [null, '/'],
  ])('%s → %s', (raw, out) => expect(safeNext(raw)).toBe(out))
})
