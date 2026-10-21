/** Display helpers. UNKNOWN is shown explicitly — never as $0 (AC18). */
import { INFINITE, type Num, type Ratio } from '@/engine/types'

export const UNKNOWN = 'UNKNOWN'

export function money(n: Num | undefined, opts: { signed?: boolean } = {}): string {
  if (n === null || n === undefined) return UNKNOWN
  const abs = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n < 0 && Math.round(n) !== 0) return `−$${abs}`
  return `${opts.signed && n > 0 ? '+' : ''}$${abs}`
}

export function pct(n: Num | undefined, digits = 1): string {
  if (n === null || n === undefined) return UNKNOWN
  return `${(n * 100).toFixed(digits)}%`
}

export function ratio(r: Ratio | undefined, kind: 'pct' | 'x' = 'pct'): string {
  if (r === INFINITE) return '∞ (no cash left)'
  if (r === null || r === undefined) return UNKNOWN
  return kind === 'pct' ? pct(r) : r.toFixed(2)
}

/** DSCR is N/A (not unknown) when the scenario carries no debt. */
export function dscrText(dscr: Num, annualDebtService: Num): string {
  if (annualDebtService === 0) return 'N/A (no debt)'
  return dscr === null ? UNKNOWN : dscr.toFixed(2)
}

export function num(n: Num | undefined, digits = 0): string {
  if (n === null || n === undefined) return UNKNOWN
  return n.toLocaleString('en-US', { maximumFractionDigits: digits })
}

export function dateTime(d: Date): string {
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
}

export const isUnknown = (s: string) => s === UNKNOWN
