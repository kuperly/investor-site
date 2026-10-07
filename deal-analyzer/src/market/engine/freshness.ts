/**
 * Freshness (VF-03 §9): metric-specific policies. Age is measured from the date the value
 * describes (asOf) to the evaluation date. A value is "fresh" while a newer release could not
 * reasonably exist yet (cadence + publication lag), "aging" after that, "stale" past the stale
 * age. Annual Census data is never judged as if it should be monthly.
 */
export type FreshnessPolicyKey = 'acs5' | 'hud_fmr' | 'bls_monthly' | 'fred_monthly' | 'fhfa_quarterly' | 'manual' | 'deal_sample'

export interface FreshnessPolicy {
  label: string
  /** Fresh up to this many months after asOf. */
  freshMonths: number
  /** Stale beyond this many months; linear decline from fresh to stale. */
  staleMonths: number
  rationale: string
}

export const FRESHNESS_POLICIES: Record<FreshnessPolicyKey, FreshnessPolicy> = {
  acs5: {
    label: 'ACS 5-year (annual release, ~12-month lag)',
    freshMonths: 27,
    staleMonths: 39,
    rationale: 'asOf = end of the 5-year period. The next release appears ~12 months after the period ends and covers 12 more months: 24 months + 3 grace. Stale once two releases were missed.',
  },
  hud_fmr: {
    label: 'HUD Fair Market Rents (annual, fiscal year from Oct 1)',
    freshMonths: 15,
    staleMonths: 27,
    rationale: 'asOf = start of the fiscal year the FMR applies to. A new FMR is published each year: 12 months + 3 grace.',
  },
  bls_monthly: {
    label: 'BLS LAUS metro (monthly, ~2-month lag)',
    freshMonths: 4,
    staleMonths: 13,
    rationale: 'Monthly series published ~2 months after the reference month: 1 + 2 + 1 grace.',
  },
  fred_monthly: {
    label: 'Realtor.com listings via FRED (monthly)',
    freshMonths: 3,
    staleMonths: 13,
    rationale: 'Monthly series published early the following month: 1 + 1 + 1 grace.',
  },
  fhfa_quarterly: {
    label: 'FHFA HPI (quarterly, ~2-month lag)',
    freshMonths: 7,
    staleMonths: 16,
    rationale: 'Quarterly index published ~2 months after the quarter: 3 + 2 + 2 grace.',
  },
  manual: {
    label: 'Manually entered evidence',
    freshMonths: 12,
    staleMonths: 24,
    rationale: 'Local records and field research are re-checked yearly.',
  },
  deal_sample: {
    label: 'Deal samples (prices, rents, lender terms)',
    freshMonths: 6,
    staleMonths: 18,
    rationale: 'Prices, rents and lending terms move; samples are re-validated twice a year.',
  },
}

export type FreshnessStatus = 'fresh' | 'aging' | 'stale'

export interface FreshnessResult {
  ageMonths: number
  status: FreshnessStatus
  /** 100 fresh → linear → 0 at the stale age. */
  score: number
}

/** Whole months between two YYYY-MM-DD dates (fractional by day, 30.44 days/month). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`)
  return Math.round((ms / (1000 * 60 * 60 * 24 * 30.4375)) * 10) / 10
}

export function freshness(asOf: string, evaluationDate: string, policy: FreshnessPolicy): FreshnessResult {
  const ageMonths = Math.max(0, monthsBetween(asOf, evaluationDate))
  if (ageMonths <= policy.freshMonths) return { ageMonths, status: 'fresh', score: 100 }
  if (ageMonths >= policy.staleMonths) return { ageMonths, status: 'stale', score: 0 }
  const score = Math.round((100 * (policy.staleMonths - ageMonths)) / (policy.staleMonths - policy.freshMonths))
  return { ageMonths, status: 'aging', score }
}
