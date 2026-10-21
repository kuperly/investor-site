/**
 * Sign-in throttle: after MAX_FAILURES failed attempts for a username (or from one client
 * address) within WINDOW_MS, further attempts are refused until the window passes.
 * In memory: one app instance (Railway). Resets on restart — documented limitation.
 */
export const MAX_FAILURES = 5
export const WINDOW_MS = 15 * 60 * 1000

const failures = new Map<string, number[]>()

const recent = (key: string, now: number) => (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS)

export function isLocked(keys: string[], now = Date.now()): boolean {
  return keys.some((k) => recent(k, now).length >= MAX_FAILURES)
}

export function recordFailure(keys: string[], now = Date.now()): void {
  for (const k of keys) failures.set(k, [...recent(k, now), now])
}

export function clearFailures(keys: string[]): void {
  for (const k of keys) failures.delete(k)
}
