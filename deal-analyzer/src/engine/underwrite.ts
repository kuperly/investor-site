/**
 * Core underwriting: composes the pure formulas over nullable inputs.
 * Any UNKNOWN input makes every metric that depends on it UNKNOWN (null) and
 * is recorded on the InputReader so the UI can say exactly what is missing.
 */
import { amortizingInterest, annualDebtService, interestOnlyInterest, remainingBalance } from './finance'
import * as F from './formulas'
import type { DealInputs, InputKey, Num, NumericInputKey, Ratio } from './types'

/** Reads inputs and remembers which ones were needed but UNKNOWN. */
export class InputReader {
  readonly missing = new Set<InputKey>()
  constructor(readonly inputs: DealInputs) {}

  num(key: NumericInputKey): Num {
    const v = this.inputs[key]
    if (v === null || v === undefined) {
      this.missing.add(key)
      return null
    }
    return v
  }

  flag(key: InputKey) {
    this.missing.add(key)
  }
}

type Nullable<T extends unknown[]> = { [K in keyof T]: T[K] | null }

/** Apply `fn` only if every argument is known; otherwise UNKNOWN. */
export function lift<A extends unknown[], R>(fn: (...args: A) => R, ...args: Nullable<A>): R | null {
  if (args.some((a) => a === null || a === undefined)) return null
  return fn(...(args as A))
}

/** Sum that is UNKNOWN if any addend is UNKNOWN (never treats missing as 0). */
export function sumKnown(values: Num[]): Num {
  return values.some((v) => v === null) ? null : (values as number[]).reduce((a, b) => a + b, 0)
}

const mul = (a: number, b: number) => a * b

export type ArvKey = 'arvConservative' | 'arvBase' | 'arvUpside'
export type RentKey = 'marketRent' | 'conservativeRent' | 'upsideRent'

export interface CoreOptions {
  arvKey?: ArvKey
  rentKey?: RentKey
  arvFactor?: number
  rentFactor?: number
  rehabFactor?: number
  /** Underwrite at a different price (used by Max Offer verification). */
  purchasePrice?: number
}

export interface CoreResult {
  // §10–11
  purchasePrice: Num
  closingCosts: Num
  rehab: Num
  rehabContingency: Num
  totalRehab: Num
  acquisitionLoan: Num
  acquisitionPoints: Num
  acquisitionLoanFees: Num
  financingFees: Num
  acquisitionInterest: Num
  outstandingAcquisitionLoan: Num
  holdingCosts: Num
  otherProjectCosts: Num
  totalProjectCost: Num
  /** Linear model: All-in(P) = P × (1 + perDollar) + fixed. Used to solve Max Offer exactly. */
  costModel: { perDollar: number; fixed: number } | null
  // §12–13
  arv: Num
  equityCreated: Num
  equityCreationPct: Num
  allInToArv: Num
  // §14
  monthlyRent: Num
  rental: F.RentalResult | null
  // §15–19 BRRRR (post-refi)
  refi: {
    refiLoan: Num
    refiClosingCosts: Num
    otherRefiCosts: Num
    existingDebtPayoff: Num
    cashAvailableFromRefi: Num
    totalCashInvested: Num
    cashRecovered: Num
    cashLeftInDeal: Num
    cashReleasedBeyondEquity: Num
    capitalRecycledPct: Num
    annualDebtService: Num
    dscr: Num
    annualCashFlow: Num
    monthlyCashFlow: Num
    cashOnCash: Ratio
  }
  // Hold on acquisition financing
  hold: {
    annualDebtService: Num
    dscr: Num
    annualCashFlow: Num
    monthlyCashFlow: Num
    cashInvested: Num
    cashOnCash: Ratio
  }
  // §20 Flip
  flip: {
    salePrice: Num
    sellingCosts: Num
    netProfit: Num
    roi: Num
    margin: Num
    months: Num
  }
}

export function underwriteCore(inputs: DealInputs, opts: CoreOptions = {}, reader = new InputReader(inputs)): CoreResult {
  const arvKey = opts.arvKey ?? 'arvBase'
  const rentKey = opts.rentKey ?? 'marketRent'
  const arvFactor = opts.arvFactor ?? 1
  const rentFactor = opts.rentFactor ?? 1
  const rehabFactor = opts.rehabFactor ?? 1

  const purchasePrice = opts.purchasePrice ?? reader.num('purchasePrice')

  // Closing costs: Purchase × % (spec); the $ field is used only when % is blank.
  let closingCosts: Num
  let closingPctUsed: Num = null
  let closingFixed: Num = null
  if (inputs.closingCostPct !== null) {
    closingPctUsed = inputs.closingCostPct
    closingCosts = lift(F.closingCosts, purchasePrice, inputs.closingCostPct)
  } else if (inputs.closingCostAmount !== null) {
    closingFixed = inputs.closingCostAmount
    closingCosts = inputs.closingCostAmount
  } else {
    reader.flag('closingCostPct')
    closingCosts = null
  }

  const otherProjectCosts = sumKnown([
    reader.num('inspectionCost'),
    reader.num('attorneyCost'),
    reader.num('titleCost'),
    reader.num('otherAcquisitionCost'),
    reader.num('otherProjectCosts'),
  ])
  const holdingCosts = reader.num('holdingCosts')

  const rehab = lift(mul, reader.num('rehabEstimate'), rehabFactor)
  const rehabContingency = lift(F.rehabContingency, rehab, reader.num('rehabContingencyPct'))
  const totalRehab = lift(F.totalRehab, rehab, rehabContingency)

  // Acquisition financing — every term is an input; nothing assumed.
  const ltv = reader.num('acqLtv')
  const projectMonths = reader.num('projectMonths')
  const acquisitionLoan = lift(F.acquisitionLoan, purchasePrice, ltv)
  let acquisitionPoints: Num
  let acquisitionLoanFees: Num
  let acquisitionInterest: Num
  let outstandingAcquisitionLoan: Num
  let holdDebtService: Num
  /** Interest over the project per $1 of principal (interest is linear in principal). */
  let interestPerDollar: Num
  let pointsPct: Num = 0
  if (ltv === 0) {
    acquisitionPoints = 0
    acquisitionLoanFees = 0
    acquisitionInterest = 0
    outstandingAcquisitionLoan = 0
    holdDebtService = 0
    interestPerDollar = 0
  } else {
    pointsPct = reader.num('acqPointsPct')
    acquisitionPoints = lift(F.acquisitionPoints, acquisitionLoan, pointsPct)
    acquisitionLoanFees = reader.num('acqLoanFees')
    const rate = reader.num('acqInterestRate')
    const io = inputs.acqInterestOnly
    if (io === true) {
      interestPerDollar = lift((r, m) => interestOnlyInterest(1, r, m), rate, projectMonths)
      acquisitionInterest = lift(interestOnlyInterest, acquisitionLoan, rate, projectMonths)
      outstandingAcquisitionLoan = acquisitionLoan
      holdDebtService = lift((l, r) => annualDebtService(l, r, 1, true), acquisitionLoan, rate)
    } else if (io === false) {
      const termMonths = lift((y) => Math.round(y * 12), reader.num('acqTermYears'))
      interestPerDollar = lift((r, t, m) => amortizingInterest(1, r, t, m), rate, termMonths, projectMonths)
      acquisitionInterest = lift(amortizingInterest, acquisitionLoan, rate, termMonths, projectMonths)
      outstandingAcquisitionLoan = lift(remainingBalance, acquisitionLoan, rate, termMonths, projectMonths)
      holdDebtService = lift((l, r, t) => annualDebtService(l, r, t, false), acquisitionLoan, rate, termMonths)
    } else {
      reader.flag('acqInterestOnly')
      interestPerDollar = null
      acquisitionInterest = null
      outstandingAcquisitionLoan = null
      holdDebtService = null
    }
  }
  const financingFees = sumKnown([acquisitionPoints, acquisitionLoanFees])

  const totalProjectCost = lift(
    (pp, cc, r, rc, ff, ai, hc, oc) =>
      F.totalProjectCost({
        purchasePrice: pp,
        closingCosts: cc,
        rehab: r,
        rehabContingency: rc,
        financingFees: ff,
        acquisitionInterest: ai,
        holdingCosts: hc,
        otherProjectCosts: oc,
      }),
    purchasePrice,
    closingCosts,
    rehab,
    rehabContingency,
    financingFees,
    acquisitionInterest,
    holdingCosts,
    otherProjectCosts,
  )

  // All-in is linear in purchase price; expose the decomposition for Max Offer.
  const perDollar = lift(
    (cp, l, p, ipd) => cp + l * p + l * ipd,
    closingPctUsed ?? (closingFixed !== null ? 0 : null),
    ltv,
    pointsPct,
    interestPerDollar,
  )
  const fixed = sumKnown([closingFixed ?? 0, totalRehab, acquisitionLoanFees, holdingCosts, otherProjectCosts])
  const costModel = perDollar !== null && fixed !== null ? { perDollar, fixed } : null

  // §12–13
  const arv = lift(mul, reader.num(arvKey), arvFactor)
  const equityCreated = lift(F.equityCreated, arv, totalProjectCost)
  const equityCreationPct = lift(F.equityCreationPct, equityCreated, totalProjectCost)
  const allInToArv = lift(F.allInToArv, totalProjectCost, arv)

  // §14
  const monthlyRent = lift(mul, reader.num(rentKey), rentFactor)
  const rentalParts = {
    monthlyRent,
    vacancyPct: reader.num('vacancyPct'),
    managementPct: reader.num('managementPct'),
    maintenancePct: reader.num('maintenancePct'),
    capexPct: reader.num('capexPct'),
    taxes: reader.num('taxesAnnual'),
    insurance: reader.num('insuranceAnnual'),
    hoa: reader.num('hoaAnnual'),
    utilities: reader.num('utilitiesAnnual'),
    otherOpex: reader.num('otherOpexAnnual'),
  }
  const rental = Object.values(rentalParts).some((v) => v === null)
    ? null
    : F.rentalUnderwriting(rentalParts as F.RentalInputs)
  const noi = rental?.noi ?? null

  // §15–19 BRRRR
  const refiLtv = reader.num('refiLtv')
  const refiLoan = lift(F.refiLoan, arv, refiLtv)
  const refiClosingCosts = refiLtv === 0 ? 0 : lift(F.refiClosingCosts, refiLoan, reader.num('refiClosingCostPct'))
  const otherRefiCosts = refiLtv === 0 ? 0 : reader.num('refiOtherCosts')
  const existingDebtPayoff = outstandingAcquisitionLoan
  const cashAvailableFromRefi = lift(F.cashAvailableFromRefi, refiLoan, existingDebtPayoff, refiClosingCosts, otherRefiCosts)
  const totalCashInvested = lift(F.totalCashInvested, totalProjectCost, acquisitionLoan, reader.num('additionalEquity'))
  const cashRecovered = cashAvailableFromRefi
  const cashLeft = lift(F.cashLeftInDeal, totalCashInvested, cashRecovered)
  const capitalRecycledPct = lift(F.capitalRecycledPct, cashRecovered, totalCashInvested)

  let refiDebtService: Num
  if (refiLtv === 0) refiDebtService = 0
  else {
    const refiTermMonths = lift((y) => Math.round(y * 12), reader.num('refiTermYears'))
    refiDebtService = lift(
      (l, r, t) => annualDebtService(l, r, t, false),
      refiLoan,
      reader.num('refiInterestRate'),
      refiTermMonths,
    )
  }
  const refiDscr = lift(F.dscr, noi, refiDebtService)
  const refiAnnualCF = lift(F.annualCashFlow, noi, refiDebtService)
  const refiCoC: Ratio =
    refiAnnualCF === null || cashLeft === null ? null : F.cashOnCash(refiAnnualCF, cashLeft.cashLeft)

  // Hold (no refi — acquisition financing stays in place)
  const holdDscr = lift(F.dscr, noi, holdDebtService)
  const holdAnnualCF = lift(F.annualCashFlow, noi, holdDebtService)
  const holdCoC: Ratio =
    holdAnnualCF === null || totalCashInvested === null ? null : F.cashOnCash(holdAnnualCF, totalCashInvested)

  // §20 Flip — gross sale price is the scenario ARV (Base ARV in the base case)
  const salePrice = arv
  const sellingCosts = lift(F.sellingCosts, salePrice, reader.num('sellingCostPct'))
  const netProfit = lift(F.netFlipProfit, salePrice, sellingCosts, totalProjectCost)

  return {
    purchasePrice,
    closingCosts,
    rehab,
    rehabContingency,
    totalRehab,
    acquisitionLoan,
    acquisitionPoints,
    acquisitionLoanFees,
    financingFees,
    acquisitionInterest,
    outstandingAcquisitionLoan,
    holdingCosts,
    otherProjectCosts,
    totalProjectCost,
    costModel,
    arv,
    equityCreated,
    equityCreationPct,
    allInToArv,
    monthlyRent,
    rental,
    refi: {
      refiLoan,
      refiClosingCosts,
      otherRefiCosts,
      existingDebtPayoff,
      cashAvailableFromRefi,
      totalCashInvested,
      cashRecovered,
      cashLeftInDeal: cashLeft?.cashLeft ?? null,
      cashReleasedBeyondEquity: cashLeft?.cashReleasedBeyondEquity ?? null,
      capitalRecycledPct,
      annualDebtService: refiDebtService,
      dscr: refiDscr,
      annualCashFlow: refiAnnualCF,
      monthlyCashFlow: lift(F.monthlyCashFlow, refiAnnualCF),
      cashOnCash: refiCoC,
    },
    hold: {
      annualDebtService: holdDebtService,
      dscr: holdDscr,
      annualCashFlow: holdAnnualCF,
      monthlyCashFlow: lift(F.monthlyCashFlow, holdAnnualCF),
      cashInvested: totalCashInvested,
      cashOnCash: holdCoC,
    },
    flip: {
      salePrice,
      sellingCosts,
      netProfit,
      roi: lift(F.flipRoi, netProfit, totalCashInvested),
      margin: lift(F.flipMargin, netProfit, salePrice),
      months: projectMonths,
    },
  }
}

export interface MaxOfferResult {
  arv: Num
  targetPct: Num
  maximumAllIn: Num
  /** May be negative: no positive price reaches the target. */
  maxPurchasePrice: Num
}

/**
 * §21 Max Offer. Maximum Purchase = Maximum All-in − closing − rehab − contingency
 * − financing − holding − other. Costs that scale with price are evaluated at the
 * max-offer price itself (solving All-in(P) = ARV × target exactly).
 */
export function maxOffer(core: CoreResult, targetPct: Num): MaxOfferResult {
  const maximumAllIn = lift(F.maximumAllIn, core.arv, targetPct)
  const maxPurchasePrice =
    maximumAllIn === null || core.costModel === null
      ? null
      : (maximumAllIn - core.costModel.fixed) / (1 + core.costModel.perDollar)
  return { arv: core.arv, targetPct, maximumAllIn, maxPurchasePrice }
}
