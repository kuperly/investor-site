/** Lead intake helpers (pure): duplicate key and CSV import. */
import { PROPERTY_TYPES, type PropertyType } from '@/engine/types'
import { validateCandidate, type Candidate, type CandidateErrors } from './handoff'

const SUFFIX: Record<string, string> = {
  street: 'st', avenue: 'ave', road: 'rd', drive: 'dr', lane: 'ln', court: 'ct', boulevard: 'blvd', place: 'pl',
  terrace: 'ter', circle: 'cir', parkway: 'pkwy', highway: 'hwy', north: 'n', south: 's', east: 'e', west: 'w',
  apartment: 'apt', suite: 'ste', unit: 'unit',
}

/** "12 Main Street, Apt. 3" + "75216-1234" → "12 main st apt 3|75216". Same property → same key. */
export function addressKey(address: string, zip: string | null): string {
  const a = address
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SUFFIX[w] ?? w)
    .join(' ')
  return `${a}|${(zip ?? '').trim().slice(0, 5)}`
}

/** Minimal RFC-4180 CSV: quoted fields, "" escapes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

export const LEAD_COLUMNS = [
  'address', 'city', 'state', 'zip', 'property_type', 'beds', 'baths', 'sqft', 'year_built',
  'asking_price', 'condition', 'est_arv', 'est_rehab', 'est_rent', 'source', 'source_url', 'notes',
] as const

export const MAX_IMPORT_ROWS = 500

export type LeadInput = Omit<Candidate, 'id' | 'geoId' | 'geoName' | 'avatarName'>

export interface ImportedRow {
  line: number
  lead: LeadInput | null
  errors: CandidateErrors & { row?: string }
}

/** Blank → null (UNKNOWN). "$120,000" → 120000. Anything else non-numeric → error. */
function num(v: string | undefined): number | null | 'invalid' {
  const s = (v ?? '').replace(/[$,\s]/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : 'invalid'
}

/** CSV text → validated leads. Unknown columns are ignored; `fallbackSource` fills a blank source. */
export function parseLeadsCsv(text: string, fallbackSource: string): { rows: ImportedRow[]; error?: string } {
  const all = parseCsv(text.replace(/^﻿/, ''))
  if (all.length < 2) return { rows: [], error: 'The file needs a header row and at least one lead.' }
  const header = all[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  if (!header.includes('address')) return { rows: [], error: 'Missing an "address" column.' }
  if (all.length - 1 > MAX_IMPORT_ROWS) return { rows: [], error: `At most ${MAX_IMPORT_ROWS} leads per file.` }
  const rows = all.slice(1).map((cells, i): ImportedRow => {
    const get = (k: string) => {
      const j = header.indexOf(k)
      return j < 0 ? undefined : cells[j]?.trim()
    }
    const errors: ImportedRow['errors'] = {}
    const n = (k: string, field: keyof LeadInput) => {
      const v = num(get(k))
      if (v === 'invalid') {
        ;(errors as Record<string, string>)[field] = 'Not a number'
        return null
      }
      return v
    }
    const pt = get('property_type') || ''
    const propertyType = pt === '' ? null : (PROPERTY_TYPES.find((t) => t.toLowerCase() === pt.toLowerCase()) ?? null)
    if (pt && !propertyType) errors.propertyType = `Unknown type "${pt}" (use ${PROPERTY_TYPES.join(', ')})`
    const lead: LeadInput = {
      address: get('address') ?? '',
      city: get('city') || null,
      state: get('state')?.toUpperCase() || null,
      zip: get('zip') || null,
      propertyType: propertyType as PropertyType | null,
      beds: n('beds', 'beds'),
      baths: n('baths', 'baths'),
      sqft: n('sqft', 'sqft'),
      yearBuilt: n('year_built', 'yearBuilt'),
      askingPrice: n('asking_price', 'askingPrice'),
      condition: get('condition') || null,
      estArv: n('est_arv', 'estArv'),
      estRehab: n('est_rehab', 'estRehab'),
      estRent: n('est_rent', 'estRent'),
      source: get('source') || fallbackSource,
      sourceUrl: get('source_url') || null,
      notes: get('notes') || null,
    }
    Object.assign(errors, validateCandidate({ ...lead, geoId: 'x' }))
    return { line: i + 2, lead: Object.keys(errors).length ? null : lead, errors }
  })
  return { rows }
}
