/**
 * Feasibility at a price (Guy/Ben, Oct 15 2026): Max Offer is an economic metric, not a
 * rejection gate. For any price (asking, target, an offer) this re-runs the full analysis at
 * that purchase price and reports the gap to Max Offer and what works there.
 *
 * No new threshold: "within target" uses the existing §21 Max Offer (target All-in / ARV),
 * and "viable" uses the existing §26 strategy rules. No formula is duplicated — everything
 * comes from analyzeDeal().
 */
import { analyzeDeal } from './analyze'
import { check } from './strategies'
import type { DealInputs, Num, Tri } from './types'

export type FeasibilityStatus = 'feasible' | 'not_feasible' | 'unknown'

export interface PriceFeasibility {
  label: string
  price: Num
  /** Max Offer per ARV scenario (independent of the price tested). */
  maxOffer: { conservative: Num; base: Num; upside: Num }
  /** Price − base Max Offer. Positive = the price is above what the target allows. */
  gapUsd: Num
  /** gapUsd / price: the discount off this price needed to reach the base Max Offer. */
  gapPct: Num
  /** Price ≤ base Max Offer. A partial (optimistic) Max Offer can prove "above", not "within". */
  withinTarget: Tri
  allIn: Num
  allInToArv: Num
  dscr: Num
  monthlyCashFlow: Num
  cashLeft: Num
  flipProfit: Num
  strategies: { brrrr: Tri; hold: Tri; flip: Tri }
  /** Some figures leave out UNKNOWN line items. */
  incomplete: boolean
  status: FeasibilityStatus
  reasons: string[]
}

const usd = (x: number) => `$${Math.round(x).toLocaleString('en-US')}`

export function feasibilityAt(inputs: DealInputs, price: Num, label: string): PriceFeasibility {
  const a = analyzeDeal({ ...inputs, purchasePrice: price })
  const mo = (k: string) => a.arvScenarios.find((s) => s.key === k)?.maxOffer.maxPurchasePrice ?? null
  const base = mo('arvBase')
  const baseScenario = a.arvScenarios.find((s) => s.key === 'arvBase')!
  const maxOfferPartial = a.base.inc.maxOffer.length > 0

  const gapUsd = price === null || base === null ? null : price - base
  const gapPct = gapUsd === null || price === null || price <= 0 ? null : gapUsd / price
  const withinTarget: Tri = price === null || base === null ? null : check(price <= base, maxOfferPartial)

  const strategies = { brrrr: a.strategies.brrrr.viable, hold: a.strategies.hold.viable, flip: a.strategies.flip.viable }
  const viable = Object.values(strategies)
  const anyViable: Tri = viable.some((v) => v === true) ? true : viable.every((v) => v === false) ? false : null

  const status: FeasibilityStatus =
    withinTarget === false || anyViable === false ? 'not_feasible' : withinTarget === true && anyViable === true ? 'feasible' : 'unknown'

  const reasons: string[] = []
  if (price === null) reasons.push('No price to test')
  else if (base === null) reasons.push('Max Offer UNKNOWN (ARV, rehab or costs missing)')
  else if (gapUsd !== null && gapUsd > 0)
    reasons.push(`${usd(gapUsd)} above Max Offer (${usd(base)}): needs ${(gapPct! * 100).toFixed(1)}% off this price`)
  else if (gapUsd !== null)
    reasons.push(`${usd(-gapUsd)} at or below Max Offer (${usd(base)})${maxOfferPartial ? ' — Max Offer is partial, not yet proven' : ''}`)
  const names = { brrrr: 'BRRRR', hold: 'Hold', flip: 'Flip' } as const
  const works = (Object.keys(strategies) as (keyof typeof strategies)[]).filter((k) => strategies[k] === true).map((k) => names[k])
  const fails = (Object.keys(strategies) as (keyof typeof strategies)[]).filter((k) => strategies[k] === false).map((k) => names[k])
  if (works.length) reasons.push(`Works at this price: ${works.join(', ')}`)
  if (fails.length) reasons.push(`Does not work: ${fails.join(', ')}`)
  if (!works.length && !fails.length) reasons.push('No strategy proven yet (data incomplete)')

  const inc = a.base.inc
  return {
    label,
    price,
    maxOffer: { conservative: mo('arvConservative'), base, upside: mo('arvUpside') },
    gapUsd,
    gapPct,
    withinTarget,
    allIn: a.base.totalProjectCost,
    allInToArv: baseScenario.allInToArv,
    dscr: a.base.refi.dscr,
    monthlyCashFlow: a.base.refi.monthlyCashFlow,
    cashLeft: a.base.refi.cashLeftInDeal,
    flipProfit: a.base.flip.netProfit,
    strategies,
    incomplete: [inc.allIn, inc.dscr, inc.cashLeft, inc.flip].some((x) => x.length > 0),
    status,
    reasons,
  }
}

/**
 * The target price for a deal or lead: the latest offer we made, else the user's planned
 * offer, else the base Max Offer itself (when positive). Returns the source with it.
 */
export function targetPrice(
  latestOffer: Num,
  plannedOffer: Num,
  baseMaxOffer: Num,
): { price: Num; source: 'latest offer' | 'planned offer' | 'base Max Offer' | null } {
  if (latestOffer !== null) return { price: latestOffer, source: 'latest offer' }
  if (plannedOffer !== null) return { price: plannedOffer, source: 'planned offer' }
  if (baseMaxOffer !== null && baseMaxOffer > 0) return { price: baseMaxOffer, source: 'base Max Offer' }
  return { price: null, source: null }
}
