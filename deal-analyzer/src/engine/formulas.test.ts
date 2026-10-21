import { describe, expect, it } from 'vitest'
import * as F from './formulas'
import { INFINITE } from './types'

describe('§10 core', () => {
  it('closing costs = purchase × %', () => expect(F.closingCosts(100_000, 0.03)).toBeCloseTo(3_000))
  it('rehab contingency = rehab × %', () => expect(F.rehabContingency(40_000, 0.1)).toBeCloseTo(4_000))
  it('total rehab = rehab + contingency', () => expect(F.totalRehab(40_000, 4_000)).toBe(44_000))
  it('acquisition loan = purchase × LTV', () => expect(F.acquisitionLoan(100_000, 0.8)).toBeCloseTo(80_000))
  it('points = loan × points %', () => expect(F.acquisitionPoints(80_000, 0.02)).toBeCloseTo(1_600))
})

describe('§11 all-in', () => {
  it('sums every component', () => {
    expect(
      F.totalProjectCost({
        purchasePrice: 100_000,
        closingCosts: 3_000,
        rehab: 40_000,
        rehabContingency: 4_000,
        financingFees: 2_600,
        acquisitionInterest: 4_800,
        holdingCosts: 2_400,
        otherProjectCosts: 3_000,
      }),
    ).toBe(159_800)
  })
})

describe('§12–13 equity', () => {
  it('equity = ARV − all-in', () => expect(F.equityCreated(200_000, 159_800)).toBe(40_200))
  it('all-in / ARV', () => expect(F.allInToArv(140_000, 200_000)).toBeCloseTo(0.7))
  it('all-in / ARV with ARV 0 is N/A, not a division by zero', () => expect(F.allInToArv(1, 0)).toBeNull())
})

describe('§14 rental', () => {
  const r = F.rentalUnderwriting({
    monthlyRent: 1_800,
    vacancyPct: 0.08,
    managementPct: 0.1,
    maintenancePct: 0.05,
    capexPct: 0.05,
    taxes: 2_400,
    insurance: 1_200,
    hoa: 0,
    utilities: 0,
    otherOpex: 0,
  })
  it('gross = rent × 12', () => expect(r.grossScheduledRent).toBe(21_600))
  it('vacancy = gross × %', () => expect(r.vacancy).toBeCloseTo(1_728))
  it('EGI = gross − vacancy', () => expect(r.effectiveGrossIncome).toBeCloseTo(19_872))
  it('management is on EGI', () => expect(r.management).toBeCloseTo(1_987.2))
  it('maintenance and capex are on gross', () => {
    expect(r.maintenance).toBeCloseTo(1_080)
    expect(r.capex).toBeCloseTo(1_080)
  })
  it('NOI', () => expect(r.noi).toBeCloseTo(12_124.8))
})

describe('§15 BRRRR', () => {
  it('refi loan = ARV × LTV', () => expect(F.refiLoan(200_000, 0.75)).toBeCloseTo(150_000))
  it('refi closing = loan × %', () => expect(F.refiClosingCosts(150_000, 0.02)).toBeCloseTo(3_000))
  it('cash available = loan − payoff − closing − other', () =>
    expect(F.cashAvailableFromRefi(150_000, 80_000, 3_000, 500)).toBe(66_500))
  it('total cash invested = all-in − acq loan + additional equity', () =>
    expect(F.totalCashInvested(159_800, 80_000, 1_000)).toBe(80_800))
  it('cash left = invested − recovered', () =>
    expect(F.cashLeftInDeal(60_000, 54_000)).toEqual({ cashLeft: 6_000, cashReleasedBeyondEquity: 0 }))
  it('cash left floors at 0 and reports excess separately', () =>
    expect(F.cashLeftInDeal(60_000, 70_000)).toEqual({ cashLeft: 0, cashReleasedBeyondEquity: 10_000 }))
})

describe('§16 capital recycled', () => {
  it('spec example: $60K invested, $54K recovered = 90%', () => expect(F.capitalRecycledPct(54_000, 60_000)).toBeCloseTo(0.9))
  it('zero invested → N/A', () => expect(F.capitalRecycledPct(1, 0)).toBeNull())
})

describe('§17–19', () => {
  it('DSCR = NOI / debt service', () => expect(F.dscr(12_500, 10_000)).toBeCloseTo(1.25))
  it('DSCR with no debt service → N/A', () => expect(F.dscr(12_500, 0)).toBeNull())
  it('cash flow = NOI − debt service; monthly = annual / 12', () => {
    expect(F.annualCashFlow(12_000, 9_600)).toBe(2_400)
    expect(F.monthlyCashFlow(2_400)).toBe(200)
  })
  it('CoC = annual CF / cash left', () => expect(F.cashOnCash(2_400, 24_000)).toBeCloseTo(0.1))
  it('CoC with $0 left is INFINITE (no division by zero)', () => expect(F.cashOnCash(2_400, 0)).toBe(INFINITE))
})

describe('§20 flip', () => {
  it('selling costs = sale × %', () => expect(F.sellingCosts(200_000, 0.06)).toBeCloseTo(12_000))
  it('net profit = sale − selling − all-in', () => expect(F.netFlipProfit(200_000, 12_000, 159_800)).toBe(28_200))
  it('ROI = profit / cash invested', () => expect(F.flipRoi(28_200, 79_800)).toBeCloseTo(0.35338, 4))
  it('margin = profit / sale', () => expect(F.flipMargin(28_200, 200_000)).toBeCloseTo(0.141))
  it('ROI / margin with zero denominators → N/A', () => {
    expect(F.flipRoi(1, 0)).toBeNull()
    expect(F.flipMargin(1, 0)).toBeNull()
  })
})

describe('§21', () => {
  it('maximum all-in = ARV × target', () => expect(F.maximumAllIn(200_000, 0.7)).toBeCloseTo(140_000))
})
