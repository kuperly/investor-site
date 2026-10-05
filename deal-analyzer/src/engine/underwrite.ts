/**
 * Core underwriting: composes the pure formulas over nullable inputs.
 *
 * "Calculate with what's known" (approved by Guy, Oct 2026):
 *  - CORE drivers (purchase price, rehab estimate, ARV, rent, refi LTV/rate/term; the
 *    acquisition LTV for loan-dependent results) are strict: if one is UNKNOWN, every result that depends on it is
 *    UNKNOWN (null).
 *  - LINE ITEMS (closing %, fees, holding, expenses, selling %…) are left out of a
 *    calculation when UNKNOWN. The line item itself stays null (shown as UNKNOWN,
 *    never $0) and every result it feeds lists it in `inc` ("incomplete").
 * Missing line items are mostly costs, so partial results are optimistic: callers
 * treat a partial FAIL as proven and a partial PASS as not proven.
 */
import { amortizingInterest, annualDebtService, interestOnlyInterest, remainingBalance } from './finance'
import * as F from './formulas'
import type { DealInputs, InputKey, Num, NumericInputKey, Ratio } from './types'

/** Reads inputs and remembers which ones were needed but UNKNOWN. */
export class InputReader {
  /** Every needed-but-UNKNOWN input (core or line item) → data-integrity warnings. */
  readonly missing = new Set<InputKey>()
  /** Line items left out of calculations because they are UNKNOWN. */
  readonly omitted = new Set<InputKey>()
  constructor(readonly inputs: DealInputs) {}

  /** Core driver: UNKNOWN → null (strict). */
  num(key: NumericInputKey): Num {
    const v = this.inputs[key]
    if (v === null || v === undefined) {
      this.missing.add(key)
      return null
    }
    return v
  }

  /** Line item: UNKNOWN → null, recorded as omitted (left out of sums). */
  optional(key: NumericInputKey): Num {
    const v = this.num(key)
    if (v === null) this.omitted.add(key)
    return v
  }

  flag(key: InputKey) {
    this.missing.add(key)
  }

  omit(key: InputKey) {
    this.missing.add(key)
    this.omitted.add(key)
  }
}

type Nullable<T extends unknown[]> = { [K in keyof T]: T[K] | null }

/** Apply `fn` only if every argument is known; otherwise UNKNOWN. */
export function lift<A extends unknown[], R>(fn: (...args: A) => R, ...args: Nullable<A>): R | null {
  if (args.some((a) => a === null || a === undefined)) return null
  return fn(...(args as A))
}

/** Sum that is UNKNOWN if any addend is UNKNOWN (strict). */
export function sumKnown(values: Num[]): Num {
  return values.some((v) => v === null) ? null : (values as number[]).reduce((a, b) => a + b, 0)
}

/** Sum of the known addends (UNKNOWN line items left out; caller flags them). */
export function sumPartial(values: Num[]): number {
  return values.reduce<number>((a, b) => a + (b ?? 0), 0)
}

const mul = (a: number, b: number) => a * b
const z = (v: Num) => v ?? 0

// ─── Line-item groups → which results they feed (drives the "incomplete" markers) ───
export const LINE_ITEMS = {
  allIn: [
    'acqLtv',
    'closingCostPct',
    'inspectionCost',
    'attorneyCost',
    'titleCost',
    'otherAcquisitionCost',
    'otherProjectCosts',
    'holdingCosts',
    'rehabContingencyPct',
    'acqPointsPct',
    'acqLoanFees',
    'acqInterestRate',
    'acqInterestOnly',
    'acqTermYears',
    'projectMonths',
  ],
  noi: [
    'vacancyPct',
    'managementPct',
    'maintenancePct',
    'capexPct',
    'taxesAnnual',
    'insuranceAnnual',
    'hoaAnnual',
    'utilitiesAnnual',
    'otherOpexAnnual',
  ],
  refi: ['refiClosingCostPct', 'refiOtherCosts'],
  equity: ['additionalEquity'],
  sale: ['sellingCostPct'],
} as const satisfies Record<string, readonly InputKey[]>

const G = LINE_ITEMS
/** Result → line items that feed it. */
export const RESULT_DEPS = {
  totalRehab: ['rehabContingencyPct'],
  financingFees: ['acqLtv', 'acqPointsPct', 'acqLoanFees'],
  otherProjectCosts: ['inspectionCost', 'attorneyCost', 'titleCost', 'otherAcquisitionCost', 'otherProjectCosts'],
  allIn: [...G.allIn],
  maxOffer: [...G.allIn],
  noi: [...G.noi],
  cashInvested: [...G.allIn, ...G.equity],
  refiCash: [...G.refi, ...G.allIn],
  cashLeft: [...G.allIn, ...G.equity, ...G.refi],
  dscr: [...G.noi],
  coc: [...G.noi, ...G.allIn, ...G.equity, ...G.refi],
  holdCashFlow: [...G.noi],
  holdCoc: [...G.noi, ...G.allIn, ...G.equity],
  flip: [...G.allIn, ...G.sale],
  flipRoi: [...G.allIn, ...G.sale, ...G.equity],
} as const satisfies Record<string, readonly InputKey[]>

export type ResultKey = keyof typeof RESULT_DEPS
/** Per result: the UNKNOWN line items it was calculated without ([] = complete). */
export type Incomplete = Record<ResultKey, InputKey[]>

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

/** Rental lines: an UNKNOWN expense line is null; totals are partial (see `inc.noi`). */
export interface RentalView {
  grossScheduledRent: number
  vacancy: Num
  effectiveGrossIncome: number
  management: Num
  maintenance: Num
  capex: Num
  taxes: Num
  insurance: Num
  hoa: Num
  utilities: Num
  otherOpex: Num
  totalOperatingExpenses: number
  noi: number
}

export interface CoreResult {
  // §10–11 (single line items: null = UNKNOWN; aggregates: partial, see inc)
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
  rental: RentalView | null
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
  /** Which UNKNOWN line items each result was calculated without. */
  inc: Incomplete
}

export function underwriteCore(inputs: DealInputs, opts: CoreOptions = {}, reader = new InputReader(inputs)): CoreResult {
  const arvKey = opts.arvKey ?? 'arvBase'
  const rentKey = opts.rentKey ?? 'marketRent'
  const arvFactor = opts.arvFactor ?? 1
  const rentFactor = opts.rentFactor ?? 1
  const rehabFactor = opts.rehabFactor ?? 1

  // CORE drivers
  const purchasePrice = opts.purchasePrice ?? reader.num('purchasePrice')
  const rehab = lift(mul, reader.num('rehabEstimate'), rehabFactor)
  // Acquisition LTV: UNKNOWN → financing costs left out of All-in (flagged), and the
  // loan-dependent results (cash invested, refi cash, cash left, hold) are UNKNOWN.
  const ltv = reader.optional('acqLtv')

  // Closing costs: Purchase × % (spec); the $ field is used only when % is blank.
  let closingCosts: Num
  let closingPctUsed = 0
  let closingFixed = 0
  if (inputs.closingCostPct !== null) {
    closingPctUsed = inputs.closingCostPct
    closingCosts = lift(F.closingCosts, purchasePrice, inputs.closingCostPct)
  } else if (inputs.closingCostAmount !== null) {
    closingFixed = inputs.closingCostAmount
    closingCosts = inputs.closingCostAmount
  } else {
    reader.omit('closingCostPct')
    closingCosts = null
  }

  const otherParts = [
    reader.optional('inspectionCost'),
    reader.optional('attorneyCost'),
    reader.optional('titleCost'),
    reader.optional('otherAcquisitionCost'),
    reader.optional('otherProjectCosts'),
  ]
  const otherProjectCosts = sumPartial(otherParts)
  const holdingCosts = reader.optional('holdingCosts')

  const contingencyPct = reader.optional('rehabContingencyPct')
  const rehabContingency = lift(F.rehabContingency, rehab, contingencyPct)
  const totalRehab = lift((r) => F.totalRehab(r, z(rehabContingency)), rehab)

  // Acquisition financing — every term is an input; nothing assumed.
  const projectMonths = reader.optional('projectMonths')
  const acquisitionLoan = lift(F.acquisitionLoan, purchasePrice, ltv)
  let acquisitionPoints: Num = 0
  let acquisitionLoanFees: Num = 0
  let acquisitionInterest: Num = 0
  let outstandingAcquisitionLoan: Num = 0
  let holdDebtService: Num = 0
  /** Interest over the project per $1 of principal (interest is linear in principal); 0 if UNKNOWN. */
  let interestPerDollar = 0
  let pointsPct = 0
  if (ltv === null) {
    acquisitionPoints = acquisitionLoanFees = acquisitionInterest = outstandingAcquisitionLoan = holdDebtService = null
  } else if (ltv > 0) {
    const pp = reader.optional('acqPointsPct')
    pointsPct = z(pp)
    acquisitionPoints = lift(F.acquisitionPoints, acquisitionLoan, pp)
    acquisitionLoanFees = reader.optional('acqLoanFees')
    const rate = reader.optional('acqInterestRate')
    const io = inputs.acqInterestOnly
    if (io === null) reader.omit('acqInterestOnly')
    const termMonths = io === false ? lift((y) => Math.round(y * 12), reader.optional('acqTermYears')) : null
    if (io === true && rate !== null && projectMonths !== null) {
      interestPerDollar = interestOnlyInterest(1, rate, projectMonths)
      acquisitionInterest = lift(interestOnlyInterest, acquisitionLoan, rate, projectMonths)
    } else if (io === false && rate !== null && termMonths !== null && projectMonths !== null) {
      interestPerDollar = amortizingInterest(1, rate, termMonths, projectMonths)
      acquisitionInterest = lift(amortizingInterest, acquisitionLoan, rate, termMonths, projectMonths)
    } else {
      acquisitionInterest = null // left out of All-in; flagged via inc
    }
    // Payoff at refi: amortizing with known terms → remaining balance; otherwise the full
    // principal (interest-only, or terms UNKNOWN — conservative).
    outstandingAcquisitionLoan =
      io === false && rate !== null && termMonths !== null && projectMonths !== null
        ? lift(remainingBalance, acquisitionLoan, rate, termMonths, projectMonths)
        : acquisitionLoan
    holdDebtService =
      io === true && rate !== null
        ? lift((l, r) => annualDebtService(l, r, 1, true), acquisitionLoan, rate)
        : io === false && rate !== null && termMonths !== null
          ? lift((l, r, t) => annualDebtService(l, r, t, false), acquisitionLoan, rate, termMonths)
          : null
  }
  const financingFees = ltv === null ? null : sumPartial([acquisitionPoints, acquisitionLoanFees])

  const totalProjectCost = lift(
    (pp, r) =>
      F.totalProjectCost({
        purchasePrice: pp,
        closingCosts: z(closingCosts),
        rehab: r,
        rehabContingency: z(rehabContingency),
        financingFees: z(financingFees),
        acquisitionInterest: z(acquisitionInterest),
        holdingCosts: z(holdingCosts),
        otherProjectCosts,
      }),
    purchasePrice,
    rehab,
  )

  // All-in is linear in purchase price; expose the decomposition for Max Offer.
  const l = z(ltv)
  const costModel =
    totalRehab === null
      ? null
      : {
          perDollar: closingPctUsed + l * pointsPct + l * interestPerDollar,
          fixed: closingFixed + totalRehab + (l > 0 ? z(acquisitionLoanFees) : 0) + z(holdingCosts) + otherProjectCosts,
        }

  // §12–13
  const arv = lift(mul, reader.num(arvKey), arvFactor)
  const equityCreated = lift(F.equityCreated, arv, totalProjectCost)
  const equityCreationPct = lift(F.equityCreationPct, equityCreated, totalProjectCost)
  const allInToArv = lift(F.allInToArv, totalProjectCost, arv)

  // §14
  const monthlyRent = lift(mul, reader.num(rentKey), rentFactor)
  const ex = {
    vacancyPct: reader.optional('vacancyPct'),
    managementPct: reader.optional('managementPct'),
    maintenancePct: reader.optional('maintenancePct'),
    capexPct: reader.optional('capexPct'),
    taxes: reader.optional('taxesAnnual'),
    insurance: reader.optional('insuranceAnnual'),
    hoa: reader.optional('hoaAnnual'),
    utilities: reader.optional('utilitiesAnnual'),
    otherOpex: reader.optional('otherOpexAnnual'),
  }
  let rental: RentalView | null = null
  if (monthlyRent !== null) {
    const r = F.rentalUnderwriting({
      monthlyRent,
      vacancyPct: z(ex.vacancyPct),
      managementPct: z(ex.managementPct),
      maintenancePct: z(ex.maintenancePct),
      capexPct: z(ex.capexPct),
      taxes: z(ex.taxes),
      insurance: z(ex.insurance),
      hoa: z(ex.hoa),
      utilities: z(ex.utilities),
      otherOpex: z(ex.otherOpex),
    })
    rental = {
      ...r,
      vacancy: ex.vacancyPct === null ? null : r.vacancy,
      management: ex.managementPct === null ? null : r.management,
      maintenance: ex.maintenancePct === null ? null : r.maintenance,
      capex: ex.capexPct === null ? null : r.capex,
      taxes: ex.taxes,
      insurance: ex.insurance,
      hoa: ex.hoa,
      utilities: ex.utilities,
      otherOpex: ex.otherOpex,
    }
  }
  const noi = rental?.noi ?? null

  // §15–19 BRRRR
  const refiLtv = reader.num('refiLtv')
  const refiLoan = lift(F.refiLoan, arv, refiLtv)
  const refiClosingCosts =
    refiLtv === 0 ? 0 : lift(F.refiClosingCosts, refiLoan, reader.optional('refiClosingCostPct'))
  const otherRefiCosts = refiLtv === 0 ? 0 : reader.optional('refiOtherCosts')
  const existingDebtPayoff = outstandingAcquisitionLoan
  const cashAvailableFromRefi = lift(
    (l, d) => F.cashAvailableFromRefi(l, d, z(refiClosingCosts), z(otherRefiCosts)),
    refiLoan,
    existingDebtPayoff,
  )
  const totalCashInvested = lift(
    (a, l) => F.totalCashInvested(a, l, z(reader.optional('additionalEquity'))),
    totalProjectCost,
    acquisitionLoan,
  )
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
  const sellingCosts = lift(F.sellingCosts, salePrice, reader.optional('sellingCostPct'))
  const netProfit = lift((s, a) => F.netFlipProfit(s, z(sellingCosts), a), salePrice, totalProjectCost)

  const inc = Object.fromEntries(
    Object.entries(RESULT_DEPS).map(([k, deps]) => [k, (deps as readonly InputKey[]).filter((d) => reader.omitted.has(d))]),
  ) as Incomplete

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
    inc,
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
 * max-offer price itself (solving All-in(P) = ARV × target exactly). UNKNOWN line
 * items are left out (see `inc.maxOffer`), which makes a partial Max Offer optimistic.
 */
export function maxOffer(core: CoreResult, targetPct: Num): MaxOfferResult {
  const maximumAllIn = lift(F.maximumAllIn, core.arv, targetPct)
  const maxPurchasePrice =
    maximumAllIn === null || core.costModel === null
      ? null
      : (maximumAllIn - core.costModel.fixed) / (1 + core.costModel.perDollar)
  return { arv: core.arv, targetPct, maximumAllIn, maxPurchasePrice }
}
