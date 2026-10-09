/**
 * Layer 4 screening (pure).
 *  1. Buy-box screen: the lead's facts against its target's avatar. Every bound is Guy/Ben's
 *     own avatar criterion — nothing here invents a threshold. A missing fact is "unknown",
 *     never a pass or a fail.
 *  2. Indicative check: the Deal Analyzer engine (analyzeDeal) run on the lead's own estimates
 *     plus ValeForge default assumptions. Clearly an indication, never stored on a deal, and no
 *     BUY / PASS: that decision belongs to layer 5.
 */
import { analyzeDeal } from '@/engine/analyze'
import { applyDefaults, emptyInputs, type DealDefaults } from '@/engine/fields'
import type { DealInputs, Num, PropertyType } from '@/engine/types'
import type { Avatar, AvatarPropertyType } from '@/market/engine/avatar'
import type { Candidate } from './handoff'

export type CriterionResult = 'pass' | 'fail' | 'unknown'
export type ScreenOverall = 'pass' | 'incomplete' | 'fail' | 'no_buy_box'

export interface Criterion {
  label: string
  result: CriterionResult
  detail: string
}

export interface BuyBoxScreen {
  overall: ScreenOverall
  avatarName: string | null
  criteria: Criterion[]
}

/** Deal Analyzer property types → avatar types. SFR can be detached or attached. */
const TYPE_MAP: Record<PropertyType, AvatarPropertyType[]> = {
  SFR: ['sfh_detached', 'sfh_attached'],
  Duplex: ['small_mf'],
  Triplex: ['small_mf'],
  Fourplex: ['small_mf'],
  Multifamily: ['mf_5plus'],
  Other: [],
}

const fmt = (v: number, money: boolean) => (money ? `$${Math.round(v).toLocaleString('en-US')}` : String(v))

function range(label: string, value: Num, min: Num, max: Num, money = false): Criterion | null {
  if (min === null && max === null) return null
  const bounds = `${min === null ? '…' : fmt(min, money)}–${max === null ? '…' : fmt(max, money)}`
  if (value === null) return { label, result: 'unknown', detail: `UNKNOWN (buy box ${bounds})` }
  const ok = (min === null || value >= min) && (max === null || value <= max)
  return { label, result: ok ? 'pass' : 'fail', detail: `${fmt(value, money)} vs ${bounds}` }
}

type Lead = Pick<Candidate, 'propertyType' | 'beds' | 'sqft' | 'yearBuilt' | 'askingPrice' | 'estArv' | 'estRehab' | 'estRent'>

export function screenBuyBox(c: Lead, avatar: Avatar | null): BuyBoxScreen {
  if (!avatar) return { overall: 'no_buy_box', avatarName: null, criteria: [] }
  const out: (Criterion | null)[] = []
  if (avatar.propertyTypes.length) {
    if (c.propertyType === null) out.push({ label: 'Property type', result: 'unknown', detail: 'UNKNOWN' })
    else {
      const ok = TYPE_MAP[c.propertyType].some((t) => avatar.propertyTypes.includes(t))
      out.push({ label: 'Property type', result: ok ? 'pass' : 'fail', detail: `${c.propertyType} vs ${avatar.propertyTypes.join(', ')}` })
    }
  }
  out.push(
    range('Bedrooms', c.beds, avatar.bedsMin, avatar.bedsMax),
    range('Year built', c.yearBuilt, avatar.yearBuiltMin, avatar.yearBuiltMax),
    range('Square feet', c.sqft, avatar.sqftMin, avatar.sqftMax),
    range('Asking price', c.askingPrice, avatar.purchaseMin, avatar.purchaseMax, true),
    range('Estimated ARV', c.estArv, avatar.arvMin, avatar.arvMax, true),
    range('Estimated rehab', c.estRehab, avatar.rehabMin, avatar.rehabMax, true),
    range('Estimated rent ($/mo)', c.estRent, avatar.rentMin, null, true),
  )
  const criteria = out.filter((x): x is Criterion => x !== null)
  const overall: ScreenOverall = criteria.some((x) => x.result === 'fail')
    ? 'fail'
    : criteria.some((x) => x.result === 'unknown') || criteria.length === 0
      ? 'incomplete'
      : 'pass'
  return { overall, avatarName: avatar.name, criteria }
}

export interface IndicativeCheck {
  allIn: Num
  equity: Num
  maxOfferBase: Num
  /** Asking price minus Max Offer (positive = asking above what the target All-in/ARV allows). */
  askingOverMaxOffer: Num
  capitalRecycledPct: Num
  dscr: Num
  flipNetProfit: Num
  /** True when the Deal Analyzer marked any result incomplete (missing line items). */
  incomplete: boolean
  missing: string[]
}

/** What the Deal Analyzer would say on the lead's estimates — an indication only. */
export function indicativeCheck(c: Lead & Pick<Candidate, 'baths'>, defaults: DealDefaults): IndicativeCheck {
  const facts: Partial<DealInputs> = {
    propertyType: c.propertyType,
    beds: c.beds,
    baths: c.baths,
    sqft: c.sqft,
    yearBuilt: c.yearBuilt,
    askingPrice: c.askingPrice,
    purchasePrice: c.askingPrice,
    rehabEstimate: c.estRehab,
    arvBase: c.estArv,
    marketRent: c.estRent,
  }
  const { inputs } = applyDefaults({ ...emptyInputs(), ...facts }, defaults)
  const a = analyzeDeal(inputs)
  const b = a.base
  const mo = a.arvScenarios.find((s) => s.key === 'arvBase')?.maxOffer.maxPurchasePrice ?? null
  return {
    allIn: b.totalProjectCost,
    equity: b.equityCreated,
    maxOfferBase: mo,
    askingOverMaxOffer: mo !== null && c.askingPrice !== null ? c.askingPrice - mo : null,
    capitalRecycledPct: b.refi.capitalRecycledPct,
    dscr: b.refi.dscr,
    flipNetProfit: b.flip.netProfit,
    incomplete: Object.values(b.inc).some((l) => l.length > 0),
    missing: a.missing.map((m) => m.field),
  }
}
