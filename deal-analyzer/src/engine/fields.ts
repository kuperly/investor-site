/**
 * Field registry — labels, kinds and form sections for every input.
 * Used by the form (UI), the input parser (server) and the
 * missing-data warnings (engine), so a field is described exactly once.
 */
import {
  ARV_CONFIDENCES,
  GATE_ANSWERS,
  PROPERTY_TYPES,
  REHAB_COMPLEXITIES,
  type DealInputs,
  type InputKey,
} from './types'
import { SPEC } from './config'

export type FieldKind = 'text' | 'money' | 'percent' | 'number' | 'integer' | 'enum' | 'boolean' | 'gate'

export interface FieldDef {
  key: InputKey
  label: string
  kind: FieldKind
  options?: readonly string[]
  /** Short unit hint shown next to the input. */
  unit?: string
  help?: string
  /** Custom "Underwriting incomplete — …" message when the value is missing. */
  missingMessage?: string
}

export interface FieldSection {
  id: string
  title: string
  description?: string
  fields: FieldDef[]
}

export const FIELD_SECTIONS: FieldSection[] = [
  {
    id: 'property',
    title: 'Property',
    fields: [
      { key: 'address', label: 'Address', kind: 'text' },
      { key: 'city', label: 'City', kind: 'text' },
      { key: 'state', label: 'State', kind: 'text' },
      { key: 'zip', label: 'ZIP', kind: 'text' },
      { key: 'market', label: 'Market', kind: 'text', help: 'Market label used for dashboard filtering.' },
      { key: 'propertyType', label: 'Property type', kind: 'enum', options: PROPERTY_TYPES },
      { key: 'beds', label: 'Beds', kind: 'number' },
      { key: 'baths', label: 'Baths', kind: 'number' },
      { key: 'sqft', label: 'Sqft', kind: 'integer' },
      { key: 'yearBuilt', label: 'Year built', kind: 'integer' },
      { key: 'lotSize', label: 'Lot size', kind: 'text' },
      { key: 'currentCondition', label: 'Current condition', kind: 'text' },
    ],
  },
  {
    id: 'purchase',
    title: 'Purchase & acquisition costs',
    fields: [
      { key: 'askingPrice', label: 'Asking price', kind: 'money' },
      { key: 'offerPrice', label: 'Offer price', kind: 'money' },
      { key: 'purchasePrice', label: 'Purchase price', kind: 'money', help: 'Price used for underwriting.' },
      {
        key: 'closingCostPct',
        label: 'Closing costs %',
        kind: 'percent',
        help: 'Of purchase price. If blank, Closing costs $ is used instead.',
        missingMessage: 'closing costs (% or $) required',
      },
      { key: 'closingCostAmount', label: 'Closing costs $', kind: 'money', help: 'Used only when Closing costs % is blank.' },
      { key: 'inspectionCost', label: 'Inspection', kind: 'money' },
      { key: 'attorneyCost', label: 'Attorney', kind: 'money' },
      { key: 'titleCost', label: 'Title', kind: 'money' },
      { key: 'otherAcquisitionCost', label: 'Other acquisition costs', kind: 'money' },
    ],
  },
  {
    id: 'project',
    title: 'Project timeline & other costs',
    fields: [
      {
        key: 'projectMonths',
        label: 'Project months',
        kind: 'integer',
        unit: 'months',
        help: 'Purchase → refinance or sale. Drives acquisition interest.',
      },
      { key: 'holdingCosts', label: 'Holding costs (total)', kind: 'money', help: 'Taxes, insurance, utilities etc. during the project.' },
      { key: 'otherProjectCosts', label: 'Other project costs', kind: 'money' },
      { key: 'additionalEquity', label: 'Additional equity', kind: 'money', help: 'Any extra cash put in beyond the project-cost gap (enter 0 if none).' },
    ],
  },
  {
    id: 'rehab',
    title: 'Rehab',
    fields: [
      { key: 'rehabEstimate', label: 'Rehab estimate', kind: 'money' },
      { key: 'rehabContingencyPct', label: 'Rehab contingency %', kind: 'percent' },
      { key: 'rehabDurationMonths', label: 'Rehab duration', kind: 'integer', unit: 'months' },
      { key: 'rehabComplexity', label: 'Rehab complexity', kind: 'enum', options: REHAB_COMPLEXITIES },
    ],
  },
  {
    id: 'acqFinancing',
    title: 'Acquisition financing',
    description: 'No lender terms are assumed — enter the actual quote. For an all-cash purchase enter LTV 0%.',
    fields: [
      { key: 'acqLoanType', label: 'Loan type', kind: 'text', help: 'e.g. Hard money, Private, Conventional, Cash' },
      { key: 'acqLtv', label: 'LTV', kind: 'percent', help: 'Of purchase price.' },
      { key: 'acqInterestRate', label: 'Interest rate', kind: 'percent', unit: '/yr' },
      { key: 'acqPointsPct', label: 'Points', kind: 'percent', help: 'Of loan amount.' },
      { key: 'acqLoanFees', label: 'Loan fees', kind: 'money' },
      { key: 'acqTermYears', label: 'Loan term', kind: 'number', unit: 'years' },
      { key: 'acqInterestOnly', label: 'Interest only?', kind: 'boolean' },
    ],
  },
  {
    id: 'refi',
    title: 'Refinance',
    description: 'No lender terms are assumed — enter the actual quote.',
    fields: [
      { key: 'refiType', label: 'Refi type', kind: 'text', help: 'e.g. DSCR, Conventional' },
      { key: 'refiLtv', label: 'Refi LTV', kind: 'percent', help: 'Of ARV.' },
      { key: 'refiInterestRate', label: 'Interest rate', kind: 'percent', unit: '/yr' },
      { key: 'refiTermYears', label: 'Term', kind: 'number', unit: 'years' },
      { key: 'refiClosingCostPct', label: 'Closing costs %', kind: 'percent', help: 'Of refi loan.' },
      { key: 'refiOtherCosts', label: 'Other refi costs', kind: 'money', help: 'Enter 0 if none.' },
      { key: 'refiPrepaymentPenalty', label: 'Prepayment penalty', kind: 'text', help: 'Recorded for reference, e.g. "5-4-3-2-1".' },
      { key: 'refiSeasoningMonths', label: 'Seasoning requirement', kind: 'integer', unit: 'months' },
      {
        key: 'refiMinDscr',
        label: 'Lender minimum DSCR',
        kind: 'number',
        help: 'Hard-gate threshold (§25). Lender term — not assumed.',
        missingMessage: 'lender minimum DSCR required to evaluate the DSCR hard gate',
      },
    ],
  },
  {
    id: 'value',
    title: 'Value (ARV & comps)',
    fields: [
      { key: 'arvConservative', label: 'Conservative ARV', kind: 'money' },
      { key: 'arvBase', label: 'Base ARV', kind: 'money' },
      { key: 'arvUpside', label: 'Upside ARV', kind: 'money' },
      { key: 'compCount', label: 'Number of comps', kind: 'integer' },
      { key: 'compAvgPrice', label: 'Average comp price', kind: 'money' },
      { key: 'compMedianPrice', label: 'Median comp price', kind: 'money' },
      { key: 'compDistanceMiles', label: 'Comp distance', kind: 'number', unit: 'mi' },
      { key: 'compRecencyMonths', label: 'Comp recency', kind: 'number', unit: 'months' },
      { key: 'compRenovatedCount', label: 'Renovated comps', kind: 'integer' },
      { key: 'compUnrenovatedCount', label: 'Unrenovated comps', kind: 'integer' },
      { key: 'arvConfidence', label: 'ARV confidence', kind: 'enum', options: ARV_CONFIDENCES },
    ],
  },
  {
    id: 'rental',
    title: 'Rental',
    description: 'Rents are monthly. Taxes, insurance, HOA, utilities and other OpEx are annual.',
    fields: [
      { key: 'marketRent', label: 'Market rent', kind: 'money', unit: '/mo' },
      { key: 'conservativeRent', label: 'Conservative rent', kind: 'money', unit: '/mo' },
      { key: 'upsideRent', label: 'Upside rent', kind: 'money', unit: '/mo' },
      { key: 'vacancyPct', label: 'Vacancy %', kind: 'percent' },
      { key: 'managementPct', label: 'Property management %', kind: 'percent', help: 'Of effective gross income.' },
      { key: 'taxesAnnual', label: 'Taxes', kind: 'money', unit: '/yr', missingMessage: 'property tax estimate required' },
      { key: 'insuranceAnnual', label: 'Insurance', kind: 'money', unit: '/yr', missingMessage: 'insurance estimate required' },
      { key: 'hoaAnnual', label: 'HOA', kind: 'money', unit: '/yr', help: 'Enter 0 if none.' },
      { key: 'utilitiesAnnual', label: 'Utilities (owner-paid)', kind: 'money', unit: '/yr', help: 'Enter 0 if tenant-paid.' },
      { key: 'maintenancePct', label: 'Maintenance %', kind: 'percent', help: 'Of gross rent.' },
      { key: 'capexPct', label: 'CapEx %', kind: 'percent', help: 'Of gross rent.' },
      { key: 'otherOpexAnnual', label: 'Other OpEx', kind: 'money', unit: '/yr', help: 'Enter 0 if none.' },
    ],
  },
  {
    id: 'flip',
    title: 'Flip & Max Offer',
    fields: [
      { key: 'sellingCostPct', label: 'Selling costs %', kind: 'percent', help: 'Of sale price.' },
      {
        key: 'targetAllInPct',
        label: 'Target All-in / ARV',
        kind: 'percent',
        help: `Max Offer target. Spec default ${SPEC.maxOffer.defaultTargetAllInPct * 100}%.`,
      },
    ],
  },
  {
    id: 'gates',
    title: 'Hard-gate checklist',
    description: 'Qualitative gates (§25). "Yes" = the problem exists → automatic PASS. Unknown blocks a BUY.',
    fields: [
      { key: 'gateNoCredibleArv', label: 'No credible ARV?', kind: 'gate' },
      { key: 'gateTitleIssue', label: 'Major unresolved title issue?', kind: 'gate' },
      { key: 'gateUninsurable', label: 'Uninsurable property?', kind: 'gate' },
      { key: 'gateStructuralUnknownCost', label: 'Major structural problem without reliable cost?', kind: 'gate' },
      { key: 'gateAppreciationOnly', label: 'Deal depends entirely on appreciation?', kind: 'gate' },
      { key: 'gateRehabNotEstimable', label: 'Rehab scope cannot be reasonably estimated?', kind: 'gate' },
    ],
  },
]

export const ALL_FIELDS: FieldDef[] = FIELD_SECTIONS.flatMap((s) => s.fields)

export const FIELD_BY_KEY: Record<InputKey, FieldDef> = Object.fromEntries(
  ALL_FIELDS.map((f) => [f.key, f]),
) as Record<InputKey, FieldDef>

export function fieldLabel(key: InputKey): string {
  return FIELD_BY_KEY[key]?.label ?? key
}

export { GATE_ANSWERS }

/** A brand-new deal: everything UNKNOWN except spec-defined defaults. */
export function emptyInputs(): DealInputs {
  const base = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f.kind === 'gate' ? 'unknown' : null]))
  return {
    ...(base as unknown as DealInputs),
    targetAllInPct: SPEC.maxOffer.defaultTargetAllInPct,
  }
}
