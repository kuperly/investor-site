import type { DealAnalysis } from '@/engine/analyze'
import type { GateStatus } from '@/engine/gates'
import type { StrategyResult } from '@/engine/strategies'
import type { DealInputs, Tri } from '@/engine/types'
import { dscrText, money, num, pct, ratio } from '@/lib/format'
import { RecBadge } from './RecBadge'
import { Val } from './Val'

/** Pure presentation of an analysis. All numbers come from the engine. */
export function AnalysisView({ a, inputs }: { a: DealAnalysis; inputs: DealInputs }) {
  const b = a.base
  const baseOffer = a.arvScenarios.find((s) => s.key === 'arvBase')!.maxOffer
  const invested = b.refi.totalCashInvested
  const keyNumbers: [string, string][] = [
    ['Purchase', money(b.purchasePrice)],
    ['All-in', money(b.totalProjectCost)],
    ['Base ARV', money(b.arv)],
    ['Equity Created', money(b.equityCreated)],
    ['Cash Required', money(invested)],
    ['Cash Left', money(b.refi.cashLeftInDeal)],
    ['Capital Recycled', invested !== null && invested <= 0 ? 'N/A (no cash in)' : pct(b.refi.capitalRecycledPct)],
    ['DSCR', dscrText(b.refi.dscr, b.refi.annualDebtService)],
    ['Monthly Cash Flow', money(b.refi.monthlyCashFlow)],
    ['Flip Profit', money(b.flip.netProfit)],
    [`Max Offer (${pct(inputs.targetAllInPct, 0)} of Base ARV)`, money(baseOffer.maxPurchasePrice)],
  ]

  return (
    <div className="space-y-4">
      {/* §27 Score + recommendation */}
      <section className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-ink-muted">ValeForge Deal Score</div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold tabular-nums text-ink">{a.score.total}</span>
            <span className="text-ink-muted">/ 100</span>
          </div>
          {!a.score.complete && (
            <div className="text-xs text-amber-800">Incomplete — up to {a.score.maxAchievable} once unknowns are resolved</div>
          )}
        </div>
        <div className="sm:text-right">
          <RecBadge rec={a.recommendation.recommendation} size="lg" />
          <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
            {a.recommendation.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </section>

      {(a.missing.length > 0 || a.notices.length > 0) && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <h2 className="mb-1 font-semibold">Data integrity</h2>
          <ul className="list-disc space-y-0.5 pl-5">
            {a.missing.map((m) => (
              <li key={m.field}>{m.message}</li>
            ))}
            {a.notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">Key numbers</h2>
          <table className="tbl">
            <tbody>
              {keyNumbers.map(([k, v]) => (
                <tr key={k}>
                  <td className="text-ink-soft">{k}</td>
                  <td className="text-right font-medium"><Val v={v} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="h2">Why?</h2>
          <h3 className="text-sm font-semibold text-emerald-800">Why this deal scores well</h3>
          <BulletList items={a.why.strengths} empty="No strengths identified yet." />
          <h3 className="mt-3 text-sm font-semibold text-rose-800">Risks</h3>
          <BulletList items={a.why.risks} empty="No risks flagged by the engine." />
        </section>
      </div>

      {/* §26 Strategy engine */}
      <section className="card">
        <h2 className="h2">Strategy engine — the deal chooses the strategy</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StrategyCard s={a.strategies.brrrr} rows={[
            ['Capital recycled', invested !== null && invested <= 0 ? 'N/A' : pct(b.refi.capitalRecycledPct)],
            ['Cash left', money(b.refi.cashLeftInDeal)],
            ['Cash released beyond equity', money(b.refi.cashReleasedBeyondEquity)],
            ['DSCR', dscrText(b.refi.dscr, b.refi.annualDebtService)],
            ['Cash flow / mo', money(b.refi.monthlyCashFlow)],
            ['CoC', ratio(b.refi.cashOnCash)],
            ['Equity', money(b.equityCreated)],
          ]} />
          <StrategyCard s={a.strategies.hold} rows={[
            ['Cash flow / mo', money(b.hold.monthlyCashFlow)],
            ['DSCR', dscrText(b.hold.dscr, b.hold.annualDebtService)],
            ['CoC', ratio(b.hold.cashOnCash)],
            ['Cash invested', money(b.hold.cashInvested)],
            ['Equity', money(b.equityCreated)],
          ]} />
          <StrategyCard s={a.strategies.flip} rows={[
            ['Net profit', money(b.flip.netProfit)],
            ['ROI', pct(b.flip.roi)],
            ['Margin', pct(b.flip.margin)],
            ['Stress profit (combined)', money(a.stress.find((r) => r.id === 'combined')?.flipProfit ?? null)],
            ['Time', b.flip.months === null ? 'UNKNOWN' : `${b.flip.months} months`],
          ]} />
          <StrategyCard s={a.strategies.hybrid} rows={[
            ['Best use of capital', a.strategies.hybrid.bestUseOfCapital ?? '—'],
            ['Viable exits', String(a.strategies.viableCount)],
          ]} note={a.strategies.hybrid.rationale} />
        </div>
      </section>

      {/* §12, §13, §21 */}
      <section className="card">
        <h2 className="h2">ARV scenarios & Max Offer</h2>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Scenario</th><th>ARV</th><th>All-in</th><th>Equity</th><th>Equity / All-in</th><th>All-in / ARV</th><th>Max All-in</th><th>Max Offer</th>
              </tr>
            </thead>
            <tbody>
              {a.arvScenarios.map((s) => (
                <tr key={s.key}>
                  <td className="font-medium">{s.label}</td>
                  <td><Val v={money(s.arv)} /></td>
                  <td><Val v={money(s.allIn)} /></td>
                  <td><Val v={money(s.equity)} /></td>
                  <td><Val v={pct(s.equityPct)} /></td>
                  <td><Val v={pct(s.allInToArv)} /></td>
                  <td><Val v={money(s.maxOffer.maximumAllIn)} /></td>
                  <td className="font-semibold"><Val v={money(s.maxOffer.maxPurchasePrice)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Target All-in / ARV {pct(inputs.targetAllInPct, 0)}. Max Offer recomputes price-linked costs (closing %, points, interest) at the offer price.
        </p>
      </section>

      {/* §22 */}
      <section className="card">
        <h2 className="h2">Stress tests</h2>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Scenario</th><th>All-in</th><th>Equity</th><th>Refi loan</th><th>Cash from refi</th><th>Cash left</th><th>DSCR</th><th>Cash flow / mo</th><th>Flip profit</th>
              </tr>
            </thead>
            <tbody>
              {a.stress.map((r) => (
                <tr key={r.id} className={r.id === 'combined' ? 'bg-slate-50 font-medium' : ''}>
                  <td className="font-medium">{r.label}</td>
                  <td><Val v={money(r.allIn)} /></td>
                  <td><Val v={money(r.equity)} /></td>
                  <td><Val v={money(r.refiLoan)} /></td>
                  <td><Val v={money(r.cashAvailableFromRefi)} /></td>
                  <td><Val v={money(r.cashLeft)} /></td>
                  <td><Val v={r.dscr === null ? 'UNKNOWN' : r.dscr.toFixed(2)} /></td>
                  <td><Val v={money(r.monthlyCashFlow)} /></td>
                  <td><Val v={money(r.flipProfit)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* §23 */}
        <section className="card">
          <h2 className="h2">Score breakdown</h2>
          <table className="tbl">
            <tbody>
              {a.score.components.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="font-medium">{c.label}</div>
                    <div className="max-w-[340px] whitespace-normal text-xs text-ink-muted">{c.detail}</div>
                  </td>
                  <td className="text-right align-top font-semibold">
                    {c.points === null ? <span className="unknown">?</span> : num(c.points, 1)} / {c.max}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="font-semibold">Total</td>
                <td className="text-right font-bold">{a.score.total} / 100</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* §25 */}
        <section className="card">
          <h2 className="h2">Hard gates</h2>
          <table className="tbl">
            <tbody>
              {a.gates.map((g) => (
                <tr key={g.id}>
                  <td className="whitespace-normal">
                    <div className="font-medium">{g.label}</div>
                    <div className="text-xs text-ink-muted">{g.kind === 'computed' ? 'Computed' : 'Checklist'} · {g.detail}</div>
                  </td>
                  <td className="text-right align-top"><GateChip s={g.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* Underwriting detail */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DetailCard title="All-in (Total Project Cost)" rows={[
          ['Purchase', money(b.purchasePrice)],
          ['Closing costs', money(b.closingCosts)],
          ['Rehab', money(b.rehab)],
          ['Rehab contingency', money(b.rehabContingency)],
          ['Financing fees (points + fees)', money(b.financingFees)],
          ['Acquisition interest', money(b.acquisitionInterest)],
          ['Holding costs', money(b.holdingCosts)],
          ['Other project costs', money(b.otherProjectCosts)],
          ['Total', money(b.totalProjectCost)],
        ]} />
        <DetailCard title="Rental (annual, Market rent)" rows={[
          ['Gross scheduled rent', money(b.rental?.grossScheduledRent ?? null)],
          ['Vacancy', money(b.rental ? -b.rental.vacancy : null)],
          ['Effective gross income', money(b.rental?.effectiveGrossIncome ?? null)],
          ['Management', money(b.rental ? -b.rental.management : null)],
          ['Maintenance', money(b.rental ? -b.rental.maintenance : null)],
          ['CapEx', money(b.rental ? -b.rental.capex : null)],
          ['Taxes · Insurance · HOA', b.rental ? `${money(b.rental.taxes)} · ${money(b.rental.insurance)} · ${money(b.rental.hoa)}` : 'UNKNOWN'],
          ['Utilities · Other OpEx', b.rental ? `${money(b.rental.utilities)} · ${money(b.rental.otherOpex)}` : 'UNKNOWN'],
          ['NOI', money(b.rental?.noi ?? null)],
        ]} />
        <DetailCard title="Refinance (Base ARV)" rows={[
          ['Refi loan', money(b.refi.refiLoan)],
          ['Existing debt payoff', money(b.refi.existingDebtPayoff)],
          ['Refi closing costs', money(b.refi.refiClosingCosts)],
          ['Other refi costs', money(b.refi.otherRefiCosts)],
          ['Cash available from refi', money(b.refi.cashAvailableFromRefi)],
          ['Total cash invested', money(b.refi.totalCashInvested)],
          ['Cash left in deal', money(b.refi.cashLeftInDeal)],
          ['Annual debt service', money(b.refi.annualDebtService)],
          ['Annual cash flow', money(b.refi.annualCashFlow)],
        ]} />
      </div>

      <section className="card">
        <h2 className="h2">Conservative case (Conservative ARV + Conservative rent)</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <Stat k="Equity" v={money(a.conservativeCase.equityCreated)} />
          <Stat k="Cash left" v={money(a.conservativeCase.refi.cashLeftInDeal)} />
          <Stat k="DSCR" v={dscrText(a.conservativeCase.refi.dscr, a.conservativeCase.refi.annualDebtService)} />
          <Stat k="Cash flow / mo" v={money(a.conservativeCase.refi.monthlyCashFlow)} />
          <Stat k="Flip profit" v={money(a.conservativeCase.flip.netProfit)} />
        </dl>
      </section>
    </div>
  )
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>
  return (
    <ul className="mt-1 space-y-1 text-sm">
      {items.map((s) => (
        <li key={s} className="flex gap-2"><span aria-hidden>•</span><span>{s}</span></li>
      ))}
    </ul>
  )
}

function viableChip(v: Tri) {
  if (v === true) return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">Viable</span>
  if (v === false) return <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-800">Not viable</span>
  return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">Unknown</span>
}

function StrategyCard({ s, rows, note }: { s: StrategyResult; rows: [string, string][]; note?: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{s.strategy}</h3>
        {viableChip(s.viable)}
      </div>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="text-right font-medium tabular-nums"><Val v={v} /></dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-muted">{note ?? s.reason}</p>
    </div>
  )
}

function GateChip({ s }: { s: GateStatus }) {
  const cls =
    s === 'PASS' ? 'bg-emerald-100 text-emerald-800' : s === 'FAIL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'
  const label = s === 'PASS' ? 'Clear' : s === 'FAIL' ? 'FAIL' : 'Unknown'
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
}

function DetailCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="card">
      <h2 className="h2">{title}</h2>
      <table className="tbl">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={k} className={i === rows.length - 1 ? 'font-semibold' : ''}>
              <td className="whitespace-normal text-ink-soft">{k}</td>
              <td className="text-right"><Val v={v} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{k}</dt>
      <dd className="font-semibold tabular-nums"><Val v={v} /></dd>
    </div>
  )
}
