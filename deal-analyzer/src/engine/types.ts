/**
 * Core types for the ValeForge underwriting engine.
 *
 * Data-integrity rule (Spec §29 / AC18): every numeric input is
 * `number | null`. `null` means UNKNOWN — it is never coerced to 0.
 * Percentages are stored as decimals (0.07 = 7%).
 */

export const PROPERTY_TYPES = ['SFR', 'Duplex', 'Triplex', 'Fourplex', 'Multifamily', 'Other'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const REHAB_COMPLEXITIES = ['Light', 'Medium', 'Heavy', 'Major'] as const
export type RehabComplexity = (typeof REHAB_COMPLEXITIES)[number]

export const ARV_CONFIDENCES = ['High', 'Medium', 'Low'] as const
export type ArvConfidence = (typeof ARV_CONFIDENCES)[number]

export const DEAL_STATUSES = [
  'Lead',
  'Analyzing',
  'Investigate',
  'Offer',
  'Due Diligence',
  'Under Contract',
  'Closed',
  'Rejected',
  'Archived',
] as const
export type DealStatus = (typeof DEAL_STATUSES)[number]

/** Answer to a qualitative hard-gate question. `yes` = the problem exists. */
export const GATE_ANSWERS = ['unknown', 'no', 'yes'] as const
export type GateAnswer = (typeof GATE_ANSWERS)[number]

export const STRATEGIES = ['BRRRR', 'Hold', 'Flip', 'Hybrid'] as const
export type Strategy = (typeof STRATEGIES)[number]

export type Recommendation = 'BUY' | 'INVESTIGATE' | 'PASS'

export type Num = number | null

/** Flat input record. Keys are the single source of truth for the form, DB and engine. */
export interface DealInputs {
  // §5 Property
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  market: string | null
  propertyType: PropertyType | null
  beds: Num
  baths: Num
  sqft: Num
  yearBuilt: Num
  lotSize: string | null
  currentCondition: string | null

  // §6 Purchase
  askingPrice: Num
  offerPrice: Num
  purchasePrice: Num

  // §6 Acquisition costs
  closingCostPct: Num
  closingCostAmount: Num
  inspectionCost: Num
  attorneyCost: Num
  titleCost: Num
  otherAcquisitionCost: Num

  // §11 project-level inputs referenced by the All-in formula
  projectMonths: Num
  holdingCosts: Num
  otherProjectCosts: Num
  additionalEquity: Num

  // §6 Rehab
  rehabEstimate: Num
  rehabContingencyPct: Num
  rehabDurationMonths: Num
  rehabComplexity: RehabComplexity | null

  // §7 Acquisition financing
  acqLoanType: string | null
  acqLtv: Num
  acqInterestRate: Num
  acqPointsPct: Num
  acqLoanFees: Num
  acqTermYears: Num
  acqInterestOnly: boolean | null

  // §7 Refinance
  refiType: string | null
  refiLtv: Num
  refiInterestRate: Num
  refiTermYears: Num
  refiClosingCostPct: Num
  refiOtherCosts: Num
  refiPrepaymentPenalty: string | null
  refiSeasoningMonths: Num
  refiMinDscr: Num

  // §8 Value
  arvConservative: Num
  arvBase: Num
  arvUpside: Num
  compCount: Num
  compAvgPrice: Num
  compMedianPrice: Num
  compDistanceMiles: Num
  compRecencyMonths: Num
  compRenovatedCount: Num
  compUnrenovatedCount: Num
  arvConfidence: ArvConfidence | null

  // §9 Rental (rents monthly, fixed expenses annual)
  marketRent: Num
  conservativeRent: Num
  upsideRent: Num
  vacancyPct: Num
  managementPct: Num
  taxesAnnual: Num
  insuranceAnnual: Num
  hoaAnnual: Num
  utilitiesAnnual: Num
  maintenancePct: Num
  capexPct: Num
  otherOpexAnnual: Num

  // §20 Flip
  sellingCostPct: Num

  // §21 Max Offer target
  targetAllInPct: Num

  // §25 Qualitative hard gates (user-assessed)
  gateNoCredibleArv: GateAnswer
  gateTitleIssue: GateAnswer
  gateUninsurable: GateAnswer
  gateStructuralUnknownCost: GateAnswer
  gateAppreciationOnly: GateAnswer
  gateRehabNotEstimable: GateAnswer
}

export type InputKey = keyof DealInputs
export type NumericInputKey = {
  [K in InputKey]: DealInputs[K] extends Num ? (Num extends DealInputs[K] ? K : never) : never
}[InputKey]

/** Cash-on-cash style ratios can be infinite when nothing is left in the deal (§19). */
export const INFINITE = 'INFINITE' as const
export type Ratio = number | typeof INFINITE | null

export type Tri = boolean | null // true / false / unknown
