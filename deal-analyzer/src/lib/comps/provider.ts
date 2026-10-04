/**
 * Automation hook (step 2). A provider turns a subject property into raw comps;
 * importComps() then validates each one with the same parser as manual entry,
 * stores it with origin='import' + external_id (re-imports never duplicate),
 * and writes it to the audit trail.
 *
 * Providers return data only. They never set the deal's ARV (§30).
 * No provider is wired up yet — the data source (MLS feed, Redfin CSV export,
 * a paid API such as ATTOM / RentCast, …) is a business decision.
 */
export interface CompSubject {
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
}

/** Raw provider record — every field a string, exactly as a form would submit it. */
export interface RawComp {
  externalId: string
  address: string
  salePrice?: string
  saleDate?: string
  sqft?: string
  beds?: string
  baths?: string
  distanceMiles?: string
  condition?: string
  renovation?: '' | 'renovated' | 'unrenovated'
  sourceUrl?: string
  notes?: string
}

export interface CompProvider {
  /** Stored as the comp's `source`, e.g. "MLS". */
  source: string
  search(subject: CompSubject, opts: { radiusMiles?: number; monthsBack?: number }): Promise<RawComp[]>
}
