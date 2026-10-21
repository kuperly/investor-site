import { describe, expect, it } from 'vitest'
import {
  amortizationSchedule,
  amortizingInterest,
  annualDebtService,
  interestOnlyInterest,
  monthlyPayment,
  remainingBalance,
} from './finance'

describe('monthlyPayment', () => {
  it('matches the standard 30-yr amortization ($150k @ 7% = $997.95)', () => {
    expect(monthlyPayment(150_000, 0.07, 360)).toBeCloseTo(997.95, 2)
  })
  it('handles a 0% rate without dividing by zero', () => {
    expect(monthlyPayment(12_000, 0, 12)).toBe(1_000)
  })
  it('is 0 for a zero principal', () => {
    expect(monthlyPayment(0, 0.07, 360)).toBe(0)
  })
  it('rejects invalid terms', () => {
    expect(() => monthlyPayment(1, 0.05, 0)).toThrow(RangeError)
    expect(() => monthlyPayment(-1, 0.05, 12)).toThrow(RangeError)
  })
})

describe('amortization schedule', () => {
  it('fully repays the loan by the last payment', () => {
    const rows = amortizationSchedule(100_000, 0.06, 360)
    expect(rows).toHaveLength(360)
    expect(rows[359].balance).toBeCloseTo(0, 6)
  })
  it('first-month interest = balance × rate / 12', () => {
    const [m1] = amortizationSchedule(100_000, 0.06, 360, 1)
    expect(m1.interest).toBeCloseTo(500, 8)
  })
  it('interest over n months + principal paid = payments made', () => {
    const P = 100_000
    const pmt = monthlyPayment(P, 0.06, 360)
    const interest = amortizingInterest(P, 0.06, 360, 12)
    const bal = remainingBalance(P, 0.06, 360, 12)
    expect(interest + (P - bal)).toBeCloseTo(pmt * 12, 6)
  })
  it('remaining balance after 0 months is the principal', () => {
    expect(remainingBalance(50_000, 0.05, 360, 0)).toBe(50_000)
  })
  it('amortizing interest is linear in principal', () => {
    expect(amortizingInterest(200_000, 0.08, 360, 6)).toBeCloseTo(2 * amortizingInterest(100_000, 0.08, 360, 6), 6)
  })
})

describe('interest-only (§10)', () => {
  it('Loan × Rate × Months / 12', () => {
    expect(interestOnlyInterest(80_000, 0.12, 6)).toBeCloseTo(4_800, 8)
  })
  it('annual debt service for IO = loan × rate', () => {
    expect(annualDebtService(80_000, 0.12, 12, true)).toBeCloseTo(9_600, 8)
  })
})
