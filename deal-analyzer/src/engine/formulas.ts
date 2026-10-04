/**
 * Spec v1.0 formulas (§10–§21) as small pure functions.
 * Every function takes known numbers; UNKNOWN handling happens in underwrite.ts.
 * Division is always guarded (AC17): a zero denominator yields `null` (N/A).
 */
import { INFINITE, type Ratio } from './types'

/** Division that never divides by zero. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0 || !Number.isFinite(denominator)) return null
  return numerator / denominator
}

// §10 Core
export const closingCosts = (purchasePrice: number, closingPct: number) => purchasePrice * closingPct
export const rehabContingency = (rehab: number, contingencyPct: number) => rehab * contingencyPct
export const totalRehab = (rehab: number, contingency: number) => rehab + contingency
export const acquisitionLoan = (purchasePrice: number, ltv: number) => purchasePrice * ltv
export const acquisitionPoints = (loanAmount: number, pointsPct: number) => loanAmount * pointsPct

// §11 Total Project Cost / All-in
export interface AllInParts {
  purchasePrice: number
  closingCosts: number
  rehab: number
  rehabContingency: number
  financingFees: number
  acquisitionInterest: number
  holdingCosts: number
  otherProjectCosts: number
}
export function totalProjectCost(p: AllInParts): number {
  return (
    p.purchasePrice +
    p.closingCosts +
    p.rehab +
    p.rehabContingency +
    p.financingFees +
    p.acquisitionInterest +
    p.holdingCosts +
    p.otherProjectCosts
  )
}

// §12 / §13
export const equityCreated = (arv: number, allIn: number) => arv - allIn
export const allInToArv = (allIn: number, arv: number) => safeDivide(allIn, arv)
/** Equity / All-in — the ratio scored in §23. */
export const equityCreationPct = (equity: number, allIn: number) => safeDivide(equity, allIn)

// §14 Rental underwriting
export interface RentalInputs {
  monthlyRent: number
  vacancyPct: number
  managementPct: number
  maintenancePct: number
  capexPct: number
  taxes: number
  insurance: number
  hoa: number
  utilities: number
  otherOpex: number
}
export interface RentalResult {
  grossScheduledRent: number
  vacancy: number
  effectiveGrossIncome: number
  management: number
  maintenance: number
  capex: number
  taxes: number
  insurance: number
  hoa: number
  utilities: number
  otherOpex: number
  totalOperatingExpenses: number
  noi: number
}
export function rentalUnderwriting(i: RentalInputs): RentalResult {
  const grossScheduledRent = i.monthlyRent * 12
  const vacancy = grossScheduledRent * i.vacancyPct
  const effectiveGrossIncome = grossScheduledRent - vacancy
  const management = effectiveGrossIncome * i.managementPct
  const maintenance = grossScheduledRent * i.maintenancePct
  const capex = grossScheduledRent * i.capexPct
  const totalOperatingExpenses =
    management + maintenance + capex + i.taxes + i.insurance + i.hoa + i.utilities + i.otherOpex
  return {
    grossScheduledRent,
    vacancy,
    effectiveGrossIncome,
    management,
    maintenance,
    capex,
    taxes: i.taxes,
    insurance: i.insurance,
    hoa: i.hoa,
    utilities: i.utilities,
    otherOpex: i.otherOpex,
    totalOperatingExpenses,
    noi: effectiveGrossIncome - totalOperatingExpenses,
  }
}

// §15 BRRRR
export const refiLoan = (arv: number, refiLtv: number) => arv * refiLtv
export const refiClosingCosts = (loan: number, closingPct: number) => loan * closingPct
export const cashAvailableFromRefi = (loan: number, existingDebt: number, refiClosing: number, otherRefiCosts: number) =>
  loan - existingDebt - refiClosing - otherRefiCosts
export const totalCashInvested = (allIn: number, acqLoan: number, additionalEquity: number) =>
  allIn - acqLoan + additionalEquity

export interface CashLeftResult {
  /** Never below 0 (§15). */
  cashLeft: number
  /** Excess cash pulled out beyond the original equity; 0 when none. */
  cashReleasedBeyondEquity: number
}
export function cashLeftInDeal(cashInvested: number, cashRecovered: number): CashLeftResult {
  const raw = cashInvested - cashRecovered
  return raw < 0 ? { cashLeft: 0, cashReleasedBeyondEquity: -raw } : { cashLeft: raw, cashReleasedBeyondEquity: 0 }
}

// §16
export const capitalRecycledPct = (cashRecovered: number, cashInvested: number) => safeDivide(cashRecovered, cashInvested)

// §17 / §18
export const dscr = (noi: number, annualDebtService: number) => safeDivide(noi, annualDebtService)
export const annualCashFlow = (noi: number, annualDebtService: number) => noi - annualDebtService
export const monthlyCashFlow = (annual: number) => annual / 12

// §19 — Cash Left = 0 → INFINITE (never divide by zero)
export function cashOnCash(annualCF: number, cashLeft: number): Ratio {
  if (cashLeft <= 0) return INFINITE
  return annualCF / cashLeft
}

// §20 Flip
export const sellingCosts = (salePrice: number, sellingPct: number) => salePrice * sellingPct
export const netFlipProfit = (salePrice: number, selling: number, allIn: number) => salePrice - selling - allIn
export const flipRoi = (profit: number, cashInvested: number) => safeDivide(profit, cashInvested)
export const flipMargin = (profit: number, salePrice: number) => safeDivide(profit, salePrice)

// §21 Max Offer
export const maximumAllIn = (arv: number, targetPct: number) => arv * targetPct
