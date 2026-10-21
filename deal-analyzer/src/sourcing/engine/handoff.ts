/**
 * Layer 4 → 5: Candidate → Deal Analyzer hand-off contract (VF-03 §19).
 *
 * A Candidate ("this specific property deserves underwriting") becomes a new deal whose
 * inputs are the DealInputs contract of the Deal Analyzer. Only property facts and the asking
 * price are filled in. ARV, rehab and rent estimates are NOT applied: they go to the deal's
 * notes with their source, because the Deal Analyzer is the source of truth for underwriting
 * and its rule is that imports never fill ARV or rehab without an explicit user step.
 */
import { PROPERTY_TYPES, type DealInputs, type PropertyType } from '@/engine/types'

type N = number | null

export interface Candidate {
  id: string
  geoId: string
  geoName: string
  avatarName: string | null
  address: string
  city: string | null
  state: string | null
  zip: string | null
  propertyType: PropertyType | null
  beds: N
  baths: N
  sqft: N
  yearBuilt: N
  askingPrice: N
  condition: string | null
  estArv: N
  estRehab: N
  estRent: N
  source: string
  sourceUrl: string | null
  notes: string | null
}

export type CandidateErrors = Partial<Record<keyof Candidate, string>>

export function validateCandidate(c: Omit<Candidate, 'id' | 'geoName' | 'avatarName'>): CandidateErrors {
  const e: CandidateErrors = {}
  if (!c.address.trim()) e.address = 'Address is required'
  if (!c.source.trim()) e.source = 'Where did this candidate come from?'
  if (c.propertyType !== null && !PROPERTY_TYPES.includes(c.propertyType)) e.propertyType = 'Unknown property type'
  for (const k of ['beds', 'baths', 'sqft', 'askingPrice', 'estArv', 'estRehab', 'estRent'] as const) {
    const v = c[k]
    if (v !== null && (!Number.isFinite(v) || v < 0)) e[k] = 'Must be a number ≥ 0'
  }
  if (c.yearBuilt !== null && (c.yearBuilt < 1700 || c.yearBuilt > 2100)) e.yearBuilt = 'Year looks wrong'
  if (c.sourceUrl && !/^https?:\/\//i.test(c.sourceUrl)) e.sourceUrl = 'Must start with http:// or https://'
  return e
}

export interface DealHandoff {
  /** Fields of the Deal Analyzer's DealInputs contract that the candidate knows. */
  inputs: Partial<DealInputs>
  /** Text for the deal's general note (estimates and provenance). */
  note: string
}

const $ = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`

export function candidateToDeal(c: Candidate): DealHandoff {
  const inputs: Partial<DealInputs> = {
    address: c.address.trim(),
    city: c.city,
    state: c.state,
    zip: c.zip,
    market: c.geoName,
    propertyType: c.propertyType,
    beds: c.beds,
    baths: c.baths,
    sqft: c.sqft,
    yearBuilt: c.yearBuilt,
    askingPrice: c.askingPrice,
    currentCondition: c.condition,
  }
  const est = [
    c.estArv !== null ? `ARV ≈ ${$(c.estArv)}` : null,
    c.estRehab !== null ? `rehab ≈ ${$(c.estRehab)}` : null,
    c.estRent !== null ? `rent ≈ ${$(c.estRent)}/month` : null,
  ].filter(Boolean)
  const note = [
    `Handed off from VF-03 Market Intelligence: ${c.geoName}${c.avatarName ? `, avatar “${c.avatarName}”` : ''}.`,
    `Candidate source: ${c.source}${c.sourceUrl ? ` (${c.sourceUrl})` : ''}.`,
    est.length
      ? `Candidate estimates (NOT applied — verify and enter them in the deal): ${est.join(', ')}.`
      : 'No ARV / rehab / rent estimates on the candidate.',
    c.notes ? `Candidate notes: ${c.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
  return { inputs, note }
}
