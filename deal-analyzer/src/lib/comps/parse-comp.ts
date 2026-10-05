/**
 * Validates/normalises a comp. Used for manual entry (FormData) AND for
 * automated imports, so both paths enforce the same rules.
 * Blank → null (UNKNOWN). Structural checks only — no valuation rules.
 */
import { COMP_TIERS, RENOVATIONS, SALE_STATUSES, type Comp } from '@/engine/comps'
import { parseNumber } from '@/lib/parse-inputs'

export type CompErrors = Partial<Record<keyof Comp, string>>

export const COMP_SOURCES = ['Manual', 'MLS', 'Zillow', 'Redfin', 'Realtor.com', 'Public records', 'Agent'] as const

function num(raw: string, opts: { integer?: boolean } = {}): { v: number | null; e?: string } {
  const n = parseNumber(raw)
  if (n === null) return { v: null }
  if (n === 'invalid') return { v: null, e: 'Enter a number' }
  if (n < 0) return { v: null, e: 'Cannot be negative' }
  if (opts.integer && !Number.isInteger(n)) return { v: null, e: 'Enter a whole number' }
  return { v: n }
}

const text = (s: string, max = 500) => (s.trim() === '' ? null : s.trim().slice(0, max))

export function parseComp(get: (key: string) => string | null, today = new Date()): { comp: Comp; errors: CompErrors } {
  const errors: CompErrors = {}
  const g = (k: string) => get(k) ?? ''
  const field = (k: keyof Comp, r: { v: number | null; e?: string }) => {
    if (r.e) errors[k] = r.e
    return r.v
  }

  let saleDate: string | null = text(g('saleDate'), 10)
  if (saleDate) {
    const t = Date.parse(`${saleDate}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || Number.isNaN(t)) {
      errors.saleDate = 'Use YYYY-MM-DD'
      saleDate = null
    } else if (t > today.getTime()) {
      errors.saleDate = 'Sale date cannot be in the future'
      saleDate = null
    }
  }

  let sourceUrl = text(g('sourceUrl'), 2000)
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    errors.sourceUrl = 'Must start with http:// or https://'
    sourceUrl = null
  }

  const ren = g('renovation')
  const renovation = (RENOVATIONS as readonly string[]).includes(ren) ? (ren as Comp['renovation']) : null

  const st = g('saleStatus')
  const saleStatus = (SALE_STATUSES as readonly string[]).includes(st) ? (st as Comp['saleStatus']) : null
  const tr = g('tier')
  const tier = (COMP_TIERS as readonly string[]).includes(tr) ? (tr as Comp['tier']) : 'standard'

  // Optional fixed share of the comp ARV, entered as a percent; Super comps only.
  let shareOverride: number | null = null
  const so = num(g('shareOverridePct'))
  if (so.e) errors.shareOverride = so.e
  else if (so.v !== null) {
    if (tier !== 'superComp') errors.shareOverride = 'Only Super comps can have a % override'
    else if (so.v <= 0 || so.v > 100) errors.shareOverride = 'Enter a percentage above 0 and up to 100'
    else shareOverride = Number((so.v / 100).toPrecision(12))
  }

  const comp: Comp = {
    address: text(g('address')) ?? '',
    salePrice: field('salePrice', num(g('salePrice'))),
    saleDate,
    sqft: field('sqft', num(g('sqft'), { integer: true })),
    beds: field('beds', num(g('beds'))),
    baths: field('baths', num(g('baths'))),
    distanceMiles: field('distanceMiles', num(g('distanceMiles'))),
    condition: text(g('condition')),
    renovation,
    saleStatus,
    tier,
    shareOverride,
    source: text(g('source'), 100),
    sourceUrl,
    notes: text(g('notes'), 2000),
    included: g('included') !== 'false',
  }
  if (!comp.address) errors.address = 'Address is required'
  return { comp, errors }
}

/** Comp → form strings (for the edit form). */
export function compToForm(c: Comp): Record<string, string> {
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  return {
    address: c.address,
    salePrice: s(c.salePrice),
    saleDate: s(c.saleDate),
    sqft: s(c.sqft),
    beds: s(c.beds),
    baths: s(c.baths),
    distanceMiles: s(c.distanceMiles),
    condition: s(c.condition),
    renovation: s(c.renovation),
    saleStatus: s(c.saleStatus),
    tier: c.tier,
    shareOverridePct: c.shareOverride === null ? '' : String(Number((c.shareOverride * 100).toPrecision(12))),
    source: s(c.source),
    sourceUrl: s(c.sourceUrl),
    notes: s(c.notes),
    included: c.included ? 'true' : 'false',
  }
}
