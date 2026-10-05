import type { DealAnalysis } from '@/engine/analyze'
import { fieldLabel } from '@/engine/fields'
import type { GateStatus } from '@/engine/gates'
import type { StrategyResult } from '@/engine/strategies'
import type { DealInputs, InputKey, Tri } from '@/engine/types'
import { dscrText, money, num, pct, ratio } from '@/lib/format'
import { RecBadge } from './RecBadge'
import { IncompleteLegend, Val } from './Val'

type Row = [label: string, value: string, inc?: readonly InputKey[]]

/** Pure presentation of an analysis. All numbers come from the engine. */
export function AnalysisView({ a, inputs, defaulted = [] }: { a: DealAnalysis; inputs: DealInputs; defaulted?: readonly InputKey[] }) {
  const b = a.base
  const baseOffer = a.arvScenarios.find((s) => s.key === 'arvBase')!.maxOffer
  const invested = b.refi.totalCashInvested
  const I = b.inc
  // Show the legend only when a marked (numeric, incomplete) figure is on screen.
  const anyIncomplete = (b.totalProjectCost !== null && I.allIn.length > 0) || (b.rental !== null && I.noi.length > 0)
  const keyNumbers: Row[] = [
    ['Purchase', money(b.purchasePrice)],
    ['All-in', money(b.totalProjectCost), I.allIn],
    ['Base ARV', money(b.arv)],
    ['Equity Created', money(b.equityCreated), I.allIn],
    ['Cash Required', money(invested), I.cashInvested],
    ['Cash Left', money(b.refi.cashLeftInDeal), I.cashLeft],
    ['Capital Recycled', invested !== null && invested <= 0 ? 'N/A (no cash in)' : pct(b.refi.capitalRecycledPct), I.cashLeft],
    ['DSCR', dscrText(b.refi.dscr, b.refi.annualDebtService), I.dscr],
    ['Monthly Cash Flow', money(b.refi.monthlyCashFlow), I.dscr],
    ['Flip Profit', money(b.flip.netProfit), I.flip],
    [`Max Offer (${pct(inputs.targetAllInPct, 0)} of Base ARV)`, money(baseOffer.maxPurchasePrice), I.maxOffer],
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

      {defaulted.length > 0 && (
        <section className="rounded-lg border border-teal-300 bg-teal-50 p-4 text-sm text-teal-950">
          <h2 className="mb-1 font-semibold">Using ValeForge defaults (not yet confirmed for this deal)</h2>
          <p>{defaulted.map(fieldLabel).join(' · ')}</p>
          <p className="mt-1 text-xs">Confirm or change them on the Edit page.</p>
        </section>
      )}

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
              {keyNumbers.map(([k, v, inc]) => (
                <tr key={k}>
                  <td className="text-ink-soft">{k}</td>
                  <td className="text-right font-medium"><Val v={v} inc={inc} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <IncompleteLegend show={anyIncomplete} />
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
            ['Capital recycled', invested !== null && invested <= 0 ? 'N/A' : pct(b.refi.capitalRecycledPct), I.cashLeft],
            ['Cash left', money(b.refi.cashLeftInDeal), I.cashLeft],
            ['Cash released beyond equity', money(b.refi.cashReleasedBeyondEquity), I.cashLeft],
            ['DSCR', dscrText(b.refi.dscr, b.refi.annualDebtService), I.dscr],
            ['Cash flow / mo', money(b.refi.monthlyCashFlow), I.dscr],
            ['CoC', ratio(b.refi.cashOnCash), I.coc],
            ['Equity', money(b.equityCreated), I.allIn],
          ]} />
          <StrategyCard s={a.strategies.hold} rows={[
            ['Cash flow / mo', money(b.hold.monthlyCashFlow), I.holdCashFlow],
            ['DSCR', dscrText(b.hold.dscr, b.hold.annualDebtService), I.holdCashFlow],
            ['CoC', ratio(b.hold.cashOnCash), I.holdCoc],
            ['Cash invested', money(b.hold.cashInvested), I.cashInvested],
            ['Equity', money(b.equityCreated), I.allIn],
          ]} />
          <StrategyCard s={a.strategies.flip} rows={[
            ['Net profit', money(b.flip.netProfit), I.flip],
            ['ROI', pct(b.flip.roi), I.flipRoi],
            ['Margin', pct(b.flip.margin), I.flip],
            ['Stress profit (combined)', money(a.stress.find((r) => r.id === 'combined')?.flipProfit ?? null), I.flip],
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
                  <td><Val v={money(s.allIn)} inc={I.allIn} /></td>
                  <td><Val v={money(s.equity)} inc={I.allIn} /></td>
                  <td><Val v={pct(s.equityPct)} inc={I.allIn} /></td>
                  <td><Val v={pct(s.allInToArv)} inc={I.allIn} /></td>
                  <td><Val v={money(s.maxOffer.maximumAllIn)} /></td>
                  <td className="font-semibold"><Val v={money(s.maxOffer.maxPurchasePrice)} inc={I.maxOffer} /></td>
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
                  <td className="font-medium">
                    {r.label}
                    {r.incomplete && <sup className="ml-0.5 font-bold text-amber-700" title="Some figures leave out UNKNOWN inputs">*</sup>}
                  </td>
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
                    {c.points === null ? <span className="unknown">?</span> : num(c.points, 1)}
                    {c.incomplete && c.points !== null && (
                      <sup className="ml-0.5 font-bold text-amber-700" title="Upper bound: calculated from incomplete figures">*</sup>
                    )}{' '}
                    / {c.max}
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
          ['Financing fees (points + fees)', money(b.financingFees), I.financingFees],
          ['Acquisition interest', money(b.acquisitionInterest)],
          ['Holding costs', money(b.holdingCosts)],
          ['Other project costs', money(b.otherProjectCosts), I.otherProjectCosts],
          ['Total', money(b.totalProjectCost), I.allIn],
        ]} />
        <DetailCard title="Rental (annual, Market rent)" rows={[
          ['Gross scheduled rent', money(b.rental?.grossScheduledRent ?? null)],
          ['Vacancy', money(neg(b.rental?.vacancy))],
          ['Effective gross income', money(b.rental?.effectiveGrossIncome ?? null), b.rental?.vacancy === null ? ['vacancyPct'] : []],
          ['Management', money(neg(b.rental?.management))],
          ['Maintenance', money(neg(b.rental?.maintenance))],
          ['CapEx', money(neg(b.rental?.capex))],
          ['Taxes', money(neg(b.rental?.taxes))],
          ['Insurance', money(neg(b.rental?.insurance))],
          ['HOA', money(neg(b.rental?.hoa))],
          ['Utilities', money(neg(b.rental?.utilities))],
          ['Other OpEx', money(neg(b.rental?.otherOpex))],
          ['NOI', money(b.rental?.noi ?? null), I.noi],
        ]} />
        <DetailCard title="Refinance (Base ARV)" rows={[
          ['Refi loan', money(b.refi.refiLoan)],
          ['Existing debt payoff', money(b.refi.existingDebtPayoff)],
          ['Refi closing costs', money(b.refi.refiClosingCosts)],
          ['Other refi costs', money(b.refi.otherRefiCosts)],
          ['Cash available from refi', money(b.refi.cashAvailableFromRefi), I.refiCash],
          ['Total cash invested', money(b.refi.totalCashInvested), I.cashInvested],
          ['Cash left in deal', money(b.refi.cashLeftInDeal), I.cashLeft],
          ['Annual debt service', money(b.refi.annualDebtService)],
          ['Annual cash flow', money(b.refi.annualCashFlow), I.dscr],
        ]} />
      </div>

      <section className="card">
        <h2 className="h2">Conservative case (Conservative ARV + Conservative rent)</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <Stat k="Equity" v={money(a.conservativeCase.equityCreated)} inc={a.conservativeCase.inc.allIn} />
          <Stat k="Cash left" v={money(a.conservativeCase.refi.cashLeftInDeal)} inc={a.conservativeCase.inc.cashLeft} />
          <Stat k="DSCR" v={dscrText(a.conservativeCase.refi.dscr, a.conservativeCase.refi.annualDebtService)} inc={a.conservativeCase.inc.dscr} />
          <Stat k="Cash flow / mo" v={money(a.conservativeCase.refi.monthlyCashFlow)} inc={a.conservativeCase.inc.dscr} />
          <Stat k="Flip profit" v={money(a.conservativeCase.flip.netProfit)} inc={a.conservativeCase.inc.flip} />
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

/** Expense shown as a negative; UNKNOWN stays UNKNOWN (never −$0). */
function neg(v: number | null | undefined): number | null {
  return v === null || v === undefined ? null : -v
}

function StrategyCard({ s, rows, note }: { s: StrategyResult; rows: Row[]; note?: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{s.strategy}</h3>
        {viableChip(s.viable)}
      </div>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v, inc]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="text-right font-medium tabular-nums"><Val v={v} inc={inc} /></dd>
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

function DetailCard({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="card">
      <h2 className="h2">{title}</h2>
      <table className="tbl">
        <tbody>
          {rows.map(([k, v, inc], i) => (
            <tr key={k} className={i === rows.length - 1 ? 'font-semibold' : ''}>
              <td className="whitespace-normal text-ink-soft">{k}</td>
              <td className="text-right"><Val v={v} inc={inc} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Stat({ k, v, inc }: { k: string; v: string; inc?: readonly InputKey[] }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{k}</dt>
      <dd className="font-semibold tabular-nums"><Val v={v} inc={inc} /></dd>
    </div>
  )
}
