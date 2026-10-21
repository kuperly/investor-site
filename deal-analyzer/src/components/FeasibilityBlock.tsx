import type { FeasibilityStatus, PriceFeasibility } from '@/engine/feasibility'
import type { Tri } from '@/engine/types'
import { money, pct } from '@/lib/format'

const STATUS_STYLE: Record<FeasibilityStatus, string> = {
  feasible: 'bg-emerald-100 text-emerald-900',
  not_feasible: 'bg-rose-100 text-rose-900',
  unknown: 'bg-amber-100 text-amber-900',
}
const STATUS_LABEL: Record<FeasibilityStatus, string> = { feasible: 'Feasible', not_feasible: 'Not feasible', unknown: 'Not proven' }
const tri = (t: Tri) => (t === true ? '✓' : t === false ? '✗' : '?')

/** Feasibility at one price: gap to Max Offer in $ and %, and what works there. Display only. */
export function FeasibilityBlock({ f, compact = false }: { f: PriceFeasibility; compact?: boolean }) {
  const gap =
    f.gapUsd === null ? null : f.gapUsd > 0 ? (
      <span className="text-rose-800">
        {money(f.gapUsd)} above Max Offer · needs {pct(f.gapPct)} off
      </span>
    ) : (
      <span className="text-emerald-800">{money(-f.gapUsd)} at or below Max Offer</span>
    )
  return (
    <div className="space-y-0.5 text-xs" data-testid="feasibility">
      <div>
        <span className="font-semibold">{f.label}</span> {money(f.price)}{' '}
        <span className={`rounded px-1.5 py-0.5 font-semibold ${STATUS_STYLE[f.status]}`}>{STATUS_LABEL[f.status]}</span>
      </div>
      <div>Max Offer {money(f.maxOffer.base)}{gap && <> · {gap}</>}</div>
      {!compact && (
        <div className="text-ink-muted">
          Walk-away (conservative) {money(f.maxOffer.conservative)} · upside {money(f.maxOffer.upside)}
        </div>
      )}
      <div>
        All-in {money(f.allIn)}{f.incomplete && '*'} · DSCR {f.dscr === null ? 'UNKNOWN' : f.dscr.toFixed(2)} · CF{' '}
        {f.monthlyCashFlow === null ? 'UNKNOWN' : `${money(f.monthlyCashFlow, { signed: true })}/mo`}
        {!compact && <> · cash left {money(f.cashLeft)} · flip {money(f.flipProfit)}</>}
      </div>
      <div>
        BRRRR {tri(f.strategies.brrrr)} · Hold {tri(f.strategies.hold)} · Flip {tri(f.strategies.flip)}
      </div>
    </div>
  )
}
