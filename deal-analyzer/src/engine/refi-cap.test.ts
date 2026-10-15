import { describe, expect, it } from 'vitest'
import { analyzeDeal } from './analyze'
import { principalForPayment, monthlyPayment } from './finance'
import { dscrCapLoan } from './formulas'
import { sampleInputs } from './fixtures'

// Sample deal (fixtures.ts): ARV 200,000, refi LTV 75 % → LTV loan 150,000; 7 %, 30 years.
// NOI 12,124.80 = 21,600 rent − 8 % vacancy (1,728) − 10 % mgmt of EGI (1,987.20)
//               − 5 % + 5 % maintenance/capex of rent (2,160) − taxes 2,400 − insurance 1,200.

describe('principalForPayment — inverse of monthlyPayment', () => {
  it('round-trips a level payment', () => {
    const pmt = monthlyPayment(150_000, 0.07, 360) // 997.95
    expect(principalForPayment(pmt, 0.07, 360)).toBeCloseTo(150_000, 6)
  })
  it('zero rate: payment × months', () => expect(principalForPayment(500, 0, 120)).toBe(60_000))
  it('a payment ≤ 0 supports no loan', () => {
    expect(principalForPayment(0, 0.07, 360)).toBe(0)
    expect(principalForPayment(-100, 0.07, 360)).toBe(0)
  })
})

describe('dscrCapLoan', () => {
  it('sizes the loan so NOI / debt service = sizing DSCR', () => {
    // Max debt service = 12,124.80 / 1.25 = 9,699.84 /yr = 808.32 /mo
    // PV of 808.32 /mo at 7 %/12 over 360 months = 121,496.61
    const loan = dscrCapLoan(12_124.8, 1.25, 0.07, 360)
    expect(loan).toBeCloseTo(121_496.61, 1)
    expect((monthlyPayment(loan, 0.07, 360) * 12) / 1).toBeCloseTo(9_699.84, 4)
  })
  it('NOI ≤ 0 supports no loan', () => expect(dscrCapLoan(-1_000, 1.25, 0.07, 360)).toBe(0))
})

describe('refi sizing in analyzeDeal', () => {
  it('no sizing DSCR → LTV-only loan, unchanged results, and a notice', () => {
    const a = analyzeDeal(sampleInputs())
    expect(a.base.refi.refiLoan).toBe(150_000)
    expect(a.base.refi.ltvLoan).toBe(150_000)
    expect(a.base.refi.dscrLoanCap).toBeNull()
    expect(a.base.refi.sizedBy).toBe('LTV')
    expect(a.notices.some((n) => n.includes('LTV × ARV only'))).toBe(true)
  })

  it('a binding DSCR cap lowers the loan, raises cash left, and DSCR equals the sizing DSCR', () => {
    const a = analyzeDeal(sampleInputs({ refiSizingDscr: 1.25 }))
    const r = a.base.refi
    expect(r.sizedBy).toBe('DSCR')
    expect(r.refiLoan).toBeCloseTo(121_496.61, 1)
    expect(r.dscr).toBeCloseTo(1.25, 6)
    // Recovered = 121,496.61 − payoff 80,000 − 2 % closing 2,429.93 = 39,066.68
    // Cash left = 79,800 invested − 39,066.68 = 40,733.32
    expect(r.cashRecovered).toBeCloseTo(39_066.68, 1)
    expect(r.cashLeftInDeal).toBeCloseTo(40_733.32, 1)
    expect(a.notices.some((n) => n.includes('limited by the lender'))).toBe(true)
  })

  it('a non-binding cap leaves the LTV loan', () => {
    // At DSCR 0.8 the cap is 12,124.80 / 0.8 / 12 = 1,263 /mo → ≈ 189,838 > 150,000
    const a = analyzeDeal(sampleInputs({ refiSizingDscr: 0.8 }))
    expect(a.base.refi.sizedBy).toBe('LTV')
    expect(a.base.refi.refiLoan).toBe(150_000)
    expect(a.base.refi.dscrLoanCap).toBeGreaterThan(150_000)
  })

  it('cap active but NOI UNKNOWN → refi loan UNKNOWN, never LTV-only', () => {
    const a = analyzeDeal(sampleInputs({ refiSizingDscr: 1.25, marketRent: null }))
    expect(a.base.refi.refiLoan).toBeNull()
    expect(a.base.refi.sizedBy).toBeNull()
  })

  it('cap active with a partial NOI flags the loan-dependent results', () => {
    const a = analyzeDeal(sampleInputs({ refiSizingDscr: 1.25, insuranceAnnual: null }))
    expect(a.base.inc.cashLeft).toContain('insuranceAnnual')
    expect(a.base.inc.refiCash).toContain('insuranceAnnual')
  })

  it('without the cap, a missing expense does not touch refi cash (LTV loan ignores NOI)', () => {
    const a = analyzeDeal(sampleInputs({ insuranceAnnual: null }))
    expect(a.base.inc.refiCash).not.toContain('insuranceAnnual')
  })
})
