import { describe, expect, it } from 'vitest'
import { summarizeNegotiation, validateEvent, type NegotiationEvent } from './negotiation'

const ev = (kind: NegotiationEvent['kind'], eventDate: string, amount: number | null = null, note: string | null = null): NegotiationEvent => ({
  id: `${kind}-${eventDate}`,
  kind,
  amount,
  eventDate,
  note,
  createdBy: 'Guy',
})

describe('validateEvent', () => {
  const today = '2026-10-15'
  it('offers, counters, price cuts and closings need an amount', () => {
    expect(validateEvent({ kind: 'our_offer', amount: null, eventDate: today, note: null }, today)).toContain('Our offer needs an amount')
    expect(validateEvent({ kind: 'seller_rejected', amount: null, eventDate: today, note: null }, today)).toEqual([])
  })
  it('no future dates, no negative amounts, a lost deal needs a reason', () => {
    expect(validateEvent({ kind: 'our_offer', amount: 90_000, eventDate: '2026-10-16', note: null }, today)).toContain('Date cannot be in the future')
    expect(validateEvent({ kind: 'price_cut', amount: -1, eventDate: today, note: null }, today)).toContain('Amount must be ≥ 0')
    expect(validateEvent({ kind: 'lost', amount: null, eventDate: today, note: ' ' }, today)).toContain('Say why the deal was lost')
    expect(validateEvent({ kind: 'our_offer', amount: 1, eventDate: '2026-13-40', note: null }, today)).toContain('Date must be YYYY-MM-DD')
  })
})

describe('summarizeNegotiation', () => {
  it('no events → no contact, likelihood UNKNOWN (never scored)', () => {
    const s = summarizeNegotiation([], 100_000)
    expect(s.stage).toBe('no_contact')
    expect(s.likelihood).toBe('UNKNOWN')
    expect(s.signals).toEqual([])
    expect(s.priceCuts.totalCutPct).toBeNull()
  })

  it('stage follows the latest step by date, whatever order the events were entered in', () => {
    const s = summarizeNegotiation([ev('seller_counter', '2026-10-10', 95_000), ev('our_offer', '2026-10-01', 82_000)], 100_000)
    expect(s.stage).toBe('countered')
    expect(s.latestOffer).toBe(82_000)
    expect(s.latestCounter).toBe(95_000)
    expect(s.spread).toBe(13_000) // 95,000 − 82,000
    expect(s.lastActivity).toBe('2026-10-10')
  })

  it('price cuts: count, current asking and % below the original asking', () => {
    const s = summarizeNegotiation([ev('price_cut', '2026-09-01', 95_000), ev('price_cut', '2026-10-01', 90_000)], 100_000)
    expect(s.priceCuts).toEqual({ count: 2, firstAsking: 100_000, currentAsking: 90_000, totalCutPct: 0.1 }) // (100k − 90k) / 100k
    expect(s.stage).toBe('no_contact') // a price cut is a listing fact, not a negotiation step
    expect(s.signals[0]).toBe('2 price cuts, 10.0% below the original asking')
  })

  it('unknown original asking → cut % UNKNOWN, never 0', () => {
    const s = summarizeNegotiation([ev('price_cut', '2026-09-01', 95_000)], null)
    expect(s.priceCuts.totalCutPct).toBeNull()
    expect(s.priceCuts.currentAsking).toBe(95_000)
  })

  it('outcomes end the stage', () => {
    expect(summarizeNegotiation([ev('our_offer', '2026-10-01', 80_000), ev('lost', '2026-10-05', null, 'Sold to cash buyer')], 1).stage).toBe('lost')
    expect(summarizeNegotiation([ev('our_offer', '2026-10-01', 80_000), ev('under_contract', '2026-10-05', 84_000)], 1).stage).toBe('under_contract')
  })
})
