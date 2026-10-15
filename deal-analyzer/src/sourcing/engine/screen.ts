/**
 * Layer 4 screening (pure).
 *  1. Buy-box screen: the lead's facts against its target's avatar. Every bound is Guy/Ben's
 *     own avatar criterion — nothing here invents a threshold. A missing fact is "unknown",
 *     never a pass or a fail. The asking price is INFORMATIONAL (Guy/Ben, Oct 15 2026): a price
 *     outside the avatar's range never rejects a lead — the price question is answered by the
 *     feasibility check (gap to Max Offer), not by the buy box.
 *  2. Lead feasibility: the Deal Analyzer (feasibilityAt → analyzeDeal) run on the lead's own
 *     estimates plus ValeForge default assumptions, at the asking price and at the target
 *     price. An indication only, never stored on a deal, and no BUY / PASS: that decision
 *     belongs to layer 5.
 *  3. Lead quality: buy-box fit on the physical facts + how the economic inputs are supported.
 */
import { feasibilityAt, targetPrice, type PriceFeasibility } from '@/engine/feasibility'
import { applyDefaults, emptyInputs, type DealDefaults } from '@/engine/fields'
import type { DealInputs, Num, PropertyType } from '@/engine/types'
import type { Avatar, AvatarPropertyType } from '@/market/engine/avatar'
import type { Candidate } from './handoff'

/** 'info' = shown for context, never counted as a pass or a fail. */
export type CriterionResult = 'pass' | 'fail' | 'unknown' | 'info'
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

/** A range shown for context only (the asking price): never a pass or a fail. */
function infoRange(label: string, value: Num, min: Num, max: Num): Criterion | null {
  if (min === null && max === null) return null
  const bounds = `${min === null ? '…' : fmt(min, true)}–${max === null ? '…' : fmt(max, true)}`
  if (value === null) return { label, result: 'info', detail: `UNKNOWN (buy-box price range ${bounds})` }
  const inside = (min === null || value >= min) && (max === null || value <= max)
  return {
    label,
    result: 'info',
    detail: `${fmt(value, true)} — ${inside ? 'inside' : 'outside'} the buy-box price range ${bounds} (informational; see feasibility)`,
  }
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
    infoRange('Asking price', c.askingPrice, avatar.purchaseMin, avatar.purchaseMax),
    range('Estimated ARV', c.estArv, avatar.arvMin, avatar.arvMax, true),
    range('Estimated rehab', c.estRehab, avatar.rehabMin, avatar.rehabMax, true),
    range('Estimated rent ($/mo)', c.estRent, avatar.rentMin, null, true),
  )
  const criteria = out.filter((x): x is Criterion => x !== null)
  const scored = criteria.filter((x) => x.result !== 'info')
  const overall: ScreenOverall = scored.some((x) => x.result === 'fail')
    ? 'fail'
    : scored.some((x) => x.result === 'unknown') || scored.length === 0
      ? 'incomplete'
      : 'pass'
  return { overall, avatarName: avatar.name, criteria }
}

export interface LeadFeasibility {
  atAsking: PriceFeasibility
  atTarget: PriceFeasibility
  /** Where the target price came from. */
  targetSource: ReturnType<typeof targetPrice>['source']
  /** Deal Analyzer inputs still missing (estimates and defaults not set). */
  missing: string[]
}

/** The lead's facts and estimates as Deal Analyzer inputs, with ValeForge defaults applied. */
export function leadInputs(c: Lead & Pick<Candidate, 'baths'>, defaults: DealDefaults): DealInputs {
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
  return applyDefaults({ ...emptyInputs(), ...facts }, defaults).inputs
}

/**
 * Feasibility at the asking price and at the target price (latest offer we made, else the
 * base Max Offer). What the Deal Analyzer would say on the lead's estimates — an indication.
 */
export function leadFeasibility(c: Lead & Pick<Candidate, 'baths'>, defaults: DealDefaults, latestOffer: Num = null): LeadFeasibility {
  const inputs = leadInputs(c, defaults)
  const atAsking = feasibilityAt(inputs, c.askingPrice, 'At asking')
  const target = targetPrice(latestOffer, null, atAsking.maxOffer.base)
  const atTarget = feasibilityAt(inputs, target.price, target.source === 'latest offer' ? 'At our latest offer' : 'At target (base Max Offer)')
  return { atAsking, atTarget, targetSource: target.source, missing: feasibilityMissing(inputs, c.askingPrice) }
}

function feasibilityMissing(inputs: DealInputs, price: Num): string[] {
  const keys: (keyof DealInputs)[] = ['arvBase', 'rehabEstimate', 'marketRent']
  const out = keys.filter((k) => inputs[k] === null).map(String)
  if (price === null) out.unshift('askingPrice')
  return out
}

export type EvidenceStatus = 'verified' | 'estimate' | 'missing'

export interface LeadQuality {
  /** Buy-box fit on the physical facts (the asking price never counts). */
  fit: ScreenOverall
  /** How each economic input is supported. A lead's own figures are estimates, never verified. */
  evidence: { label: string; status: EvidenceStatus; detail: string }[]
  /** Physical facts known out of those the buy box can use. */
  factsKnown: number
  factsTotal: number
}

export function leadQuality(c: Lead & Pick<Candidate, 'baths' | 'source'>, screen: BuyBoxScreen): LeadQuality {
  const est = (label: string, v: Num): LeadQuality['evidence'][number] =>
    v === null
      ? { label, status: 'missing', detail: 'UNKNOWN' }
      : { label, status: 'estimate', detail: `${fmt(v, true)} — lead estimate (${c.source}), not verified by comps` }
  const facts = [c.propertyType, c.beds, c.baths, c.sqft, c.yearBuilt]
  return {
    fit: screen.overall,
    evidence: [est('ARV', c.estArv), est('Rent ($/mo)', c.estRent), est('Rehab', c.estRehab)],
    factsKnown: facts.filter((x) => x !== null).length,
    factsTotal: facts.length,
  }
}

/**
 * Lead prioritization — an ORDER, not a threshold: by the discount needed off the current
 * asking price to reach the base Max Offer, smallest first (a negative gap = asking already
 * below Max Offer, first of all). Leads whose gap is UNKNOWN come last. Guy/Ben decide what to
 * do with the order.
 */
export function priorityCompare(a: LeadFeasibility | null, b: LeadFeasibility | null): number {
  const ga = a?.atAsking.gapPct ?? null
  const gb = b?.atAsking.gapPct ?? null
  if (ga === null || gb === null) return (ga === null ? 1 : 0) - (gb === null ? 1 : 0)
  return ga - gb
}
