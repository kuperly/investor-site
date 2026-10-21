import { describe, expect, it } from 'vitest'
import { monthlyPayment, amortizingInterest, remainingBalance } from './finance'
import { sampleInputs } from './fixtures'
import { InputReader, maxOffer, underwriteCore } from './underwrite'

describe('underwriteCore — worked example', () => {
  const c = underwriteCore(sampleInputs())

  it('AC3: all-in is computed from every component (§11)', () => {
    expect(c.closingCosts).toBeCloseTo(3_000)
    expect(c.rehabContingency).toBeCloseTo(4_000)
    expect(c.totalRehab).toBeCloseTo(44_000)
    expect(c.acquisitionLoan).toBeCloseTo(80_000)
    expect(c.financingFees).toBeCloseTo(2_600)
    expect(c.acquisitionInterest).toBeCloseTo(4_800)
    expect(c.otherProjectCosts).toBe(3_000)
    expect(c.totalProjectCost).toBeCloseTo(159_800)
  })

  it('AC4: equity creation and all-in / ARV (§12–13)', () => {
    expect(c.equityCreated).toBeCloseTo(40_200)
    expect(c.equityCreationPct).toBeCloseTo(40_200 / 159_800)
    expect(c.allInToArv).toBeCloseTo(0.799)
  })

  it('AC6/AC7: BRRRR refi (§15–16)', () => {
    expect(c.refi.refiLoan).toBeCloseTo(150_000)
    expect(c.refi.refiClosingCosts).toBeCloseTo(3_000)
    expect(c.refi.existingDebtPayoff).toBeCloseTo(80_000)
    expect(c.refi.cashAvailableFromRefi).toBeCloseTo(67_000)
    expect(c.refi.totalCashInvested).toBeCloseTo(79_800)
    expect(c.refi.cashLeftInDeal).toBeCloseTo(12_800)
    expect(c.refi.cashReleasedBeyondEquity).toBe(0)
    expect(c.refi.capitalRecycledPct).toBeCloseTo(67_000 / 79_800)
  })

  it('AC8/AC9: DSCR and cash flow use the modeled refi loan (§17–19)', () => {
    const ads = monthlyPayment(150_000, 0.07, 360) * 12
    expect(c.rental?.noi).toBeCloseTo(12_124.8)
    expect(c.refi.annualDebtService).toBeCloseTo(ads)
    expect(c.refi.dscr).toBeCloseTo(12_124.8 / ads)
    expect(c.refi.annualCashFlow).toBeCloseTo(12_124.8 - ads)
    expect(c.refi.monthlyCashFlow).toBeCloseTo((12_124.8 - ads) / 12)
    expect(c.refi.cashOnCash).toBeCloseTo((12_124.8 - ads) / 12_800)
  })

  it('AC10: flip (§20)', () => {
    expect(c.flip.salePrice).toBe(200_000)
    expect(c.flip.sellingCosts).toBeCloseTo(12_000)
    expect(c.flip.netProfit).toBeCloseTo(28_200)
    expect(c.flip.roi).toBeCloseTo(28_200 / 79_800)
    expect(c.flip.margin).toBeCloseTo(0.141)
  })

  it('hold keeps the acquisition loan (interest-only → loan × rate)', () => {
    expect(c.hold.annualDebtService).toBeCloseTo(9_600)
    expect(c.hold.annualCashFlow).toBeCloseTo(12_124.8 - 9_600)
  })
})

describe('amortizing acquisition loan uses a real schedule', () => {
  const c = underwriteCore(sampleInputs({ acqInterestOnly: false, acqTermYears: 30, acqInterestRate: 0.06 }))
  it('interest and payoff come from the amortization schedule', () => {
    expect(c.acquisitionInterest).toBeCloseTo(amortizingInterest(80_000, 0.06, 360, 6))
    expect(c.outstandingAcquisitionLoan).toBeCloseTo(remainingBalance(80_000, 0.06, 360, 6))
  })
})

describe('cash purchase (LTV 0)', () => {
  const c = underwriteCore(
    sampleInputs({ acqLtv: 0, acqInterestRate: null, acqPointsPct: null, acqLoanFees: null, acqInterestOnly: null }),
  )
  it('needs no loan terms and has zero financing cost', () => {
    expect(c.financingFees).toBe(0)
    expect(c.acquisitionInterest).toBe(0)
    expect(c.totalProjectCost).toBeCloseTo(100_000 + 3_000 + 44_000 + 2_400 + 3_000)
  })
})

describe('cash released beyond original equity', () => {
  const c = underwriteCore(sampleInputs({ arvBase: 260_000 }))
  it('cash left floors at 0 and the excess is reported separately', () => {
    // refi 195,000 − 80,000 − 3,900 = 111,100 recovered vs 79,800 invested
    expect(c.refi.cashLeftInDeal).toBe(0)
    expect(c.refi.cashReleasedBeyondEquity).toBeCloseTo(111_100 - 79_800)
    expect(c.refi.cashOnCash).toBe('INFINITE')
  })
})

describe('AC5: Max Offer (§21)', () => {
  it('matches the hand calculation', () => {
    const c = underwriteCore(sampleInputs())
    // perDollar = 3% closing + 80%×2% points + 80%×(12%×6/12) interest = 0.094
    // fixed = 44,000 rehab + 1,000 loan fees + 2,400 holding + 3,000 other = 50,400
    expect(maxOffer(c, 0.7).maxPurchasePrice).toBeCloseTo((140_000 - 50_400) / 1.094, 6)
  })

  it.each([
    ['interest-only', {}],
    ['amortizing', { acqInterestOnly: false, acqTermYears: 30 }],
    ['closing $ instead of %', { closingCostPct: null, closingCostAmount: 4_250 }],
    ['all cash', { acqLtv: 0 }],
  ])('All-in at the Max Offer price = ARV × target (%s)', (_name, overrides) => {
    const inputs = sampleInputs(overrides)
    for (const arvKey of ['arvConservative', 'arvBase', 'arvUpside'] as const) {
      const core = underwriteCore(inputs, { arvKey })
      const mo = maxOffer(core, 0.7)
      const atOffer = underwriteCore(inputs, { arvKey, purchasePrice: mo.maxPurchasePrice! })
      expect(atOffer.totalProjectCost).toBeCloseTo(mo.maximumAllIn!, 6)
      expect(atOffer.allInToArv).toBeCloseTo(0.7, 10)
    }
  })

  it('works before a purchase price is known', () => {
    const c = underwriteCore(sampleInputs({ purchasePrice: null }))
    expect(c.totalProjectCost).toBeNull()
    expect(maxOffer(c, 0.7).maxPurchasePrice).toBeCloseTo((140_000 - 50_400) / 1.094, 6)
  })
})

describe('AC18: missing data is UNKNOWN, never $0', () => {
  it('unknown insurance: the line shows UNKNOWN, NOI/DSCR are calculated without it and flagged', () => {
    const reader = new InputReader(sampleInputs({ insuranceAnnual: null }))
    const c = underwriteCore(reader.inputs, {}, reader)
    expect(c.rental?.insurance).toBeNull() // shown as UNKNOWN, never $0
    expect(c.rental?.noi).toBeCloseTo(12_124.8 + 1_200) // partial: insurance left out
    expect(c.inc.noi).toEqual(['insuranceAnnual'])
    expect(c.inc.dscr).toEqual(['insuranceAnnual'])
    expect(c.inc.allIn).toEqual([]) // All-in doesn't depend on insurance
    expect(reader.missing.has('insuranceAnnual')).toBe(true)
    expect(c.totalProjectCost).toBeCloseTo(159_800)
  })

  it('unknown holding costs: line UNKNOWN, All-in partial and flagged (never silently understated)', () => {
    const c = underwriteCore(sampleInputs({ holdingCosts: null }))
    expect(c.holdingCosts).toBeNull()
    expect(c.totalProjectCost).toBeCloseTo(159_800 - 2_400)
    expect(c.inc.allIn).toEqual(['holdingCosts'])
    expect(c.inc.flip).toEqual(['holdingCosts'])
    expect(c.inc.maxOffer).toEqual(['holdingCosts'])
  })

  it('core drivers stay strict: unknown purchase price or rent → UNKNOWN, not partial', () => {
    expect(underwriteCore(sampleInputs({ purchasePrice: null })).totalProjectCost).toBeNull()
    const c = underwriteCore(sampleInputs({ marketRent: null }))
    expect(c.rental).toBeNull()
    expect(c.refi.dscr).toBeNull()
  })

  it('unknown acquisition LTV: financing left out of All-in (flagged); loan-dependent results UNKNOWN', () => {
    const c = underwriteCore(sampleInputs({ acqLtv: null }))
    expect(c.totalProjectCost).toBeCloseTo(159_800 - 2_600 - 4_800)
    expect(c.inc.allIn).toContain('acqLtv')
    expect(c.acquisitionLoan).toBeNull()
    expect(c.refi.totalCashInvested).toBeNull()
    expect(c.refi.cashLeftInDeal).toBeNull()
  })

  it('unknown interest-only flag is flagged, not assumed', () => {
    const reader = new InputReader(sampleInputs({ acqInterestOnly: null }))
    underwriteCore(reader.inputs, {}, reader)
    expect(reader.missing.has('acqInterestOnly')).toBe(true)
  })

  it('closing costs missing in both % and $ is flagged', () => {
    const reader = new InputReader(sampleInputs({ closingCostPct: null, closingCostAmount: null }))
    const c = underwriteCore(reader.inputs, {}, reader)
    expect(c.closingCosts).toBeNull()
    expect(reader.missing.has('closingCostPct')).toBe(true)
  })
})

describe('AC17: no division by zero anywhere', () => {
  it('zero ARV, zero rent, zero rates and zero cash invested produce no NaN/Infinity', () => {
    const c = underwriteCore(
      sampleInputs({ arvBase: 0, marketRent: 0, refiInterestRate: 0, acqInterestRate: 0, purchasePrice: 0, rehabEstimate: 0 }),
    )
    const walk = (o: unknown): void => {
      if (typeof o === 'number') expect(Number.isFinite(o)).toBe(true)
      else if (o && typeof o === 'object') Object.values(o).forEach(walk)
    }
    walk(c)
  })
})
