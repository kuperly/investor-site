/** Pipeline funnel (pure): counts per market across layers 3–6. */
import type { ScreenOverall } from './screen'

export interface FunnelLead {
  marketId: string
  targetId: string | null
  status: 'new' | 'handed_off' | 'rejected'
  screen: ScreenOverall | null
  deal: { status: string; recommendation: string | null; hasOutcome: boolean } | null
}

export interface FunnelRow {
  marketId: string
  targets: number
  leads: number
  screenPass: number
  screenIncomplete: number
  screenFail: number
  rejected: number
  handedOff: number
  buy: number
  investigate: number
  pass: number
  closed: number
  outcomes: number
}

const empty = (marketId: string): FunnelRow => ({
  marketId, targets: 0, leads: 0, screenPass: 0, screenIncomplete: 0, screenFail: 0, rejected: 0, handedOff: 0,
  buy: 0, investigate: 0, pass: 0, closed: 0, outcomes: 0,
})

export function buildFunnel(targets: { marketId: string; status: string }[], leads: FunnelLead[]): FunnelRow[] {
  const by = new Map<string, FunnelRow>()
  const row = (m: string) => by.get(m) ?? (by.set(m, empty(m)), by.get(m)!)
  for (const t of targets) if (t.status === 'active') row(t.marketId).targets++
  for (const l of leads) {
    const r = row(l.marketId)
    r.leads++
    if (l.screen === 'pass') r.screenPass++
    else if (l.screen === 'fail') r.screenFail++
    else r.screenIncomplete++
    if (l.status === 'rejected') r.rejected++
    if (l.status === 'handed_off' && l.deal) {
      r.handedOff++
      if (l.deal.recommendation === 'BUY') r.buy++
      if (l.deal.recommendation === 'INVESTIGATE') r.investigate++
      if (l.deal.recommendation === 'PASS') r.pass++
      if (l.deal.status === 'Closed') r.closed++
      if (l.deal.hasOutcome) r.outcomes++
    }
  }
  return [...by.values()]
}
