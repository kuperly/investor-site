/**
 * Avatars (VF-03 §11): the property universe ValeForge wants to pursue. Defined by Guy/Ben —
 * nothing here is a built-in or "universal" avatar.
 *
 * Avatar fit for a geography uses ACS distributions: share of housing units matching the
 * avatar's type, bedrooms, year built and value range, combined under an independence
 * assumption (an estimate, labelled as such).
 */
import type { StrategyKey } from './config'
import { STRATEGY_KEYS } from './config'
import type { EvidenceMap } from './derive'
import type { DistributionBin } from './types'

export const AVATAR_PROPERTY_TYPES = {
  sfh_detached: { label: 'Single-family detached', bins: ['1_detached'] },
  sfh_attached: { label: 'Single-family attached / townhome', bins: ['1_attached'] },
  small_mf: { label: '2–4 units', bins: ['2', '3_4'] },
  mf_5plus: { label: '5+ units', bins: ['5_9', '10_19', '20_49', '50_plus'] },
} as const
export type AvatarPropertyType = keyof typeof AVATAR_PROPERTY_TYPES

type N = number | null

export interface Avatar {
  id: string
  name: string
  description: string
  propertyTypes: AvatarPropertyType[]
  bedsMin: N
  bedsMax: N
  yearBuiltMin: N
  yearBuiltMax: N
  sqftMin: N
  sqftMax: N
  purchaseMin: N
  purchaseMax: N
  arvMin: N
  arvMax: N
  rentMin: N
  rehabMin: N
  rehabMax: N
  strategies: StrategyKey[]
  active: boolean
}

export type AvatarErrors = Partial<Record<keyof Avatar, string>>

export function validateAvatar(a: Omit<Avatar, 'id' | 'active'>): AvatarErrors {
  const e: AvatarErrors = {}
  if (!a.name.trim()) e.name = 'Name is required'
  if (a.propertyTypes.length === 0) e.propertyTypes = 'Pick at least one property type'
  const pairs: [keyof Avatar, keyof Avatar][] = [
    ['bedsMin', 'bedsMax'],
    ['yearBuiltMin', 'yearBuiltMax'],
    ['sqftMin', 'sqftMax'],
    ['purchaseMin', 'purchaseMax'],
    ['arvMin', 'arvMax'],
    ['rehabMin', 'rehabMax'],
  ]
  for (const [lo, hi] of pairs) {
    const l = a[lo as keyof typeof a] as N
    const h = a[hi as keyof typeof a] as N
    if (l !== null && l < 0) e[lo] = 'Must be ≥ 0'
    if (l !== null && h !== null && l > h) e[hi] = 'Max must be ≥ min'
  }
  if (a.strategies.some((s) => !STRATEGY_KEYS.includes(s))) e.strategies = 'Unknown strategy'
  return e
}

/** Share of a distribution falling in [lo, hi), assuming values spread evenly within each bin. */
export function shareInRange(bins: DistributionBin[], lo: number, hi: number, openLow: number, openHigh: number): number | null {
  const total = bins.reduce((s, b) => s + b.count, 0)
  if (total <= 0) return null
  let inRange = 0
  for (const b of bins) {
    const blo = b.lo ?? openLow
    const bhi = b.hi ?? openHigh
    if (bhi <= blo) continue
    const overlap = Math.max(0, Math.min(hi, bhi) - Math.max(lo, blo))
    inRange += b.count * (overlap / (bhi - blo))
  }
  return inRange / total
}

export interface AvatarFit {
  shares: { label: string; share: number | null; basis: string }[]
  /** Product of the known shares (independence assumption); null if no share is known. */
  matchShare: number | null
  /** ≈ housing units × matchShare. */
  estimatedUnits: number | null
  rentCheck: { medianRent: number | null; rentMin: N; ok: boolean | null; basis: string }
  notes: string[]
}

export function avatarFit(a: Avatar, ev: EvidenceMap): AvatarFit {
  const shares: AvatarFit['shares'] = []
  const notes: string[] = ['Estimate: shares are multiplied as if independent (ACS publishes no cross-tabulation of all four).']

  const uis = ev['acs.units_in_structure_dist']?.detail?.bins
  if (uis && a.propertyTypes.length) {
    const keys = a.propertyTypes.flatMap((t) => [...AVATAR_PROPERTY_TYPES[t].bins] as string[])
    const total = uis.reduce((s, b) => s + b.count, 0)
    shares.push({
      label: 'Property type',
      share: total > 0 ? uis.filter((b) => keys.includes(b.key)).reduce((s, b) => s + b.count, 0) / total : null,
      basis: `ACS B25024 units in structure: ${a.propertyTypes.map((t) => AVATAR_PROPERTY_TYPES[t].label).join(', ')}`,
    })
  } else shares.push({ label: 'Property type', share: null, basis: 'Units-in-structure distribution not loaded' })

  const beds = ev['acs.bedrooms_dist']?.detail?.bins
  if (a.bedsMin !== null || a.bedsMax !== null)
    shares.push({
      label: 'Bedrooms',
      share: beds ? shareInRange(beds, a.bedsMin ?? 0, (a.bedsMax ?? 9) + 1, 0, 10) : null,
      basis: beds ? `ACS B25041 bedrooms ${a.bedsMin ?? 0}–${a.bedsMax ?? '5+'}` : 'Bedroom distribution not loaded',
    })

  const yb = ev['acs.year_built_dist']?.detail?.bins
  if (a.yearBuiltMin !== null || a.yearBuiltMax !== null)
    shares.push({
      label: 'Year built',
      share: yb ? shareInRange(yb, a.yearBuiltMin ?? 1900, (a.yearBuiltMax ?? 2029) + 1, 1900, 2030) : null,
      basis: yb ? `ACS B25034 built ${a.yearBuiltMin ?? '…'}–${a.yearBuiltMax ?? '…'} ("1939 or earlier" spread over 1900–1939)` : 'Year-built distribution not loaded',
    })

  const hv = ev['acs.home_value_dist']?.detail?.bins
  const [vLo, vHi, vBasis] = a.arvMin !== null || a.arvMax !== null ? [a.arvMin, a.arvMax, 'ARV range'] : [a.purchaseMin, a.purchaseMax, 'purchase range']
  if (vLo !== null || vHi !== null)
    shares.push({
      label: 'Value',
      share: hv ? shareInRange(hv, vLo ?? 0, vHi ?? 10_000_000, 0, 4_000_000) : null,
      basis: hv ? `ACS B25075 owner-occupied home values in the avatar ${vBasis}` : 'Home-value distribution not loaded',
    })
  if (a.sqftMin !== null || a.sqftMax !== null) notes.push('Square footage is not published by the ACS; it is not part of the estimate.')

  const known = shares.filter((s) => s.share !== null).map((s) => s.share as number)
  const matchShare = known.length ? known.reduce((p, s) => p * s, 1) : null
  if (shares.some((s) => s.share === null)) notes.push('Some criteria could not be measured, so the estimate is an upper bound.')
  const units = ev['acs.housing_units']?.value ?? null

  const wants3 = a.bedsMin !== null && a.bedsMin <= 3 && (a.bedsMax === null || a.bedsMax >= 3)
  const rentEv = (wants3 && ev['acs.median_gross_rent_3br']) || ev['acs.median_gross_rent']
  const medianRent = rentEv?.value ?? null
  return {
    shares,
    matchShare,
    estimatedUnits: matchShare !== null && units !== null ? Math.round(units * matchShare) : null,
    rentCheck: {
      medianRent,
      rentMin: a.rentMin,
      ok: medianRent === null || a.rentMin === null ? null : medianRent >= a.rentMin,
      basis: rentEv ? `${rentEv.metric === 'acs.median_gross_rent_3br' ? 'ACS median gross rent, 3 bedrooms' : 'ACS median gross rent'} vs the avatar's minimum rent` : 'Median rent not loaded',
    },
    notes,
  }
}
