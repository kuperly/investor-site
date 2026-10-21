/**
 * Negotiation log (pure). Offers, seller responses, price cuts and outcomes are recorded as
 * facts; this module validates them and summarizes where a negotiation stands.
 *
 * Likelihood of seller negotiation progress is NOT scored: no rule has been validated or
 * approved (Guy/Ben, Oct 15 2026). The summary reports the recorded signals and the stage,
 * and the likelihood stays UNKNOWN until a rule calibrated on these records is approved.
 */
import type { Num } from '@/engine/types'

export const NEGOTIATION_KINDS = [
  'our_offer',
  'seller_counter',
  'seller_accepted',
  'seller_rejected',
  'no_response',
  'price_cut',
  'under_contract',
  'closed',
  'lost',
] as const
export type NegotiationKind = (typeof NEGOTIATION_KINDS)[number]

export const KIND_LABELS: Record<NegotiationKind, string> = {
  our_offer: 'Our offer',
  seller_counter: 'Seller counter-offer',
  seller_accepted: 'Seller accepted',
  seller_rejected: 'Seller rejected',
  no_response: 'No response',
  price_cut: 'Price cut (new asking)',
  under_contract: 'Under contract',
  closed: 'Closed',
  lost: 'Lost / withdrawn',
}

/** Kinds that carry a dollar amount, and must have one. */
export const KINDS_WITH_AMOUNT: readonly NegotiationKind[] = ['our_offer', 'seller_counter', 'price_cut', 'under_contract', 'closed']

export interface NegotiationEvent {
  id: string
  kind: NegotiationKind
  amount: Num
  /** YYYY-MM-DD */
  eventDate: string
  note: string | null
  createdBy: string
}

export type NewNegotiationEvent = Omit<NegotiationEvent, 'id' | 'createdBy'>

export function validateEvent(e: NewNegotiationEvent, today: string): string[] {
  const errors: string[] = []
  if (!NEGOTIATION_KINDS.includes(e.kind)) errors.push('Unknown event type')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.eventDate) || Number.isNaN(Date.parse(e.eventDate))) errors.push('Date must be YYYY-MM-DD')
  else if (e.eventDate > today) errors.push('Date cannot be in the future')
  if (KINDS_WITH_AMOUNT.includes(e.kind) && e.amount === null) errors.push(`${KIND_LABELS[e.kind]} needs an amount`)
  if (e.amount !== null && (!Number.isFinite(e.amount) || e.amount < 0)) errors.push('Amount must be ≥ 0')
  if (e.kind === 'lost' && !e.note?.trim()) errors.push('Say why the deal was lost')
  return errors
}

export type NegotiationStage =
  | 'no_contact'
  | 'offer_made'
  | 'countered'
  | 'accepted'
  | 'rejected'
  | 'no_response'
  | 'under_contract'
  | 'closed'
  | 'lost'

const STAGE_OF: Record<NegotiationKind, NegotiationStage | null> = {
  our_offer: 'offer_made',
  seller_counter: 'countered',
  seller_accepted: 'accepted',
  seller_rejected: 'rejected',
  no_response: 'no_response',
  price_cut: null, // a listing fact, not a step in our negotiation
  under_contract: 'under_contract',
  closed: 'closed',
  lost: 'lost',
}

export const STAGE_LABELS: Record<NegotiationStage, string> = {
  no_contact: 'No offer yet',
  offer_made: 'Offer made — awaiting response',
  countered: 'Seller countered',
  accepted: 'Seller accepted',
  rejected: 'Seller rejected',
  no_response: 'No response',
  under_contract: 'Under contract',
  closed: 'Closed',
  lost: 'Lost',
}

export interface NegotiationSummary {
  stage: NegotiationStage
  latestOffer: Num
  latestCounter: Num
  /** Seller counter − our latest offer (positive = still apart). */
  spread: Num
  priceCuts: { count: number; firstAsking: Num; currentAsking: Num; totalCutPct: Num }
  lastActivity: string | null
  /** Recorded facts relevant to negotiation, in words. */
  signals: string[]
  /** Not scored: no validated, approved rule exists. */
  likelihood: 'UNKNOWN'
  likelihoodNote: string
}

const usd = (x: number) => `$${Math.round(x).toLocaleString('en-US')}`

/**
 * Summarizes a lead's or deal's events. `originalAsking` is the asking price before any
 * recorded price cut (the lead's asking when it entered).
 */
export function summarizeNegotiation(events: NegotiationEvent[], originalAsking: Num): NegotiationSummary {
  const sorted = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  let stage: NegotiationStage = 'no_contact'
  let latestOffer: Num = null
  let latestCounter: Num = null
  const cuts: number[] = []
  for (const e of sorted) {
    const s = STAGE_OF[e.kind]
    if (s) stage = s
    if (e.kind === 'our_offer') latestOffer = e.amount
    if (e.kind === 'seller_counter') latestCounter = e.amount
    if (e.kind === 'price_cut' && e.amount !== null) cuts.push(e.amount)
  }
  const currentAsking = cuts.length ? cuts[cuts.length - 1] : originalAsking
  const totalCutPct =
    originalAsking !== null && originalAsking > 0 && currentAsking !== null && cuts.length ? (originalAsking - currentAsking) / originalAsking : null
  const spread = latestCounter !== null && latestOffer !== null ? latestCounter - latestOffer : null

  const signals: string[] = []
  if (cuts.length)
    signals.push(
      `${cuts.length} price cut${cuts.length > 1 ? 's' : ''}${totalCutPct !== null ? `, ${(totalCutPct * 100).toFixed(1)}% below the original asking` : ''}`,
    )
  if (latestCounter !== null) signals.push(`Seller countered at ${usd(latestCounter)}${spread !== null ? ` (${usd(spread)} above our latest offer)` : ''}`)
  const rejected = sorted.filter((e) => e.kind === 'seller_rejected').length
  if (rejected) signals.push(`${rejected} rejection${rejected > 1 ? 's' : ''}`)
  const silent = sorted.filter((e) => e.kind === 'no_response').length
  if (silent) signals.push(`${silent} offer${silent > 1 ? 's' : ''} without response`)

  return {
    stage,
    latestOffer,
    latestCounter,
    spread,
    priceCuts: { count: cuts.length, firstAsking: originalAsking, currentAsking, totalCutPct },
    lastActivity: sorted.length ? sorted[sorted.length - 1].eventDate : null,
    signals,
    likelihood: 'UNKNOWN',
    likelihoodNote: 'Not scored — no negotiation-likelihood rule has been validated or approved. Signals are recorded facts.',
  }
}
