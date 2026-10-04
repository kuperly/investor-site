import Link from 'next/link'
import { analyzeDeal } from '@/engine/analyze'
import { DEAL_STATUSES, STRATEGIES, type Recommendation } from '@/engine/types'
import { RecBadge } from '@/components/RecBadge'
import { Val } from '@/components/Val'
import { dscrText, money, shortDate } from '@/lib/format'
import { repo } from '@/lib/repo'

export const dynamic = 'force-dynamic'

type SP = Record<string, string | undefined>

export default async function Dashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const r = await repo()
  const [deals, markets, zips] = await Promise.all([
    r.list({ market: sp.market, zip: sp.zip, status: sp.status, createdFrom: sp.from, createdTo: sp.to }),
    r.distinct('market'),
    r.distinct('zip'),
  ])

  // Computed filters run on the engine output (always consistent with the current formulas).
  const minScore = sp.minScore ? Number(sp.minScore) : null
  const rows = deals
    .map((d) => ({ d, a: analyzeDeal(d.inputs) }))
    .filter(({ a }) => (minScore === null || Number.isNaN(minScore) ? true : a.score.total >= minScore))
    .filter(({ a }) => (sp.rec ? a.recommendation.recommendation === (sp.rec as Recommendation) : true))
    .filter(({ a }) => {
      if (!sp.strategy) return true
      const s = a.strategies
      const map = { BRRRR: s.brrrr, Hold: s.hold, Flip: s.flip, Hybrid: s.hybrid } as const
      return map[sp.strategy as keyof typeof map]?.viable === true
    })

  const anyFilter = ['market', 'zip', 'status', 'strategy', 'minScore', 'rec', 'from', 'to'].some((k) => sp[k])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Deal Dashboard</h1>
          <p className="text-sm text-ink-muted">
            {rows.length} deal{rows.length === 1 ? '' : 's'}
            {anyFilter ? ' (filtered)' : ''} · the deal chooses the strategy
          </p>
        </div>
      </div>

      <form className="card grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" method="get">
        <Select name="market" label="Market" value={sp.market} options={markets} />
        <Select name="zip" label="ZIP" value={sp.zip} options={zips} />
        <Select name="status" label="Status" value={sp.status} options={DEAL_STATUSES} />
        <Select name="strategy" label="Viable strategy" value={sp.strategy} options={STRATEGIES} />
        <div>
          <label className="label" htmlFor="minScore">Min score</label>
          <input id="minScore" name="minScore" type="number" min={0} max={100} defaultValue={sp.minScore} className="input" />
        </div>
        <Select name="rec" label="Recommendation" value={sp.rec} options={['BUY', 'INVESTIGATE', 'PASS']} />
        <div>
          <label className="label" htmlFor="from">Created from</label>
          <input id="from" name="from" type="date" defaultValue={sp.from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">Created to</label>
          <input id="to" name="to" type="date" defaultValue={sp.to} className="input" />
        </div>
        <div className="col-span-2 flex gap-2 sm:col-span-4 lg:col-span-8">
          <button className="btn-primary">Apply filters</button>
          {anyFilter && <Link href="/" className="btn-secondary">Clear</Link>}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="card text-center text-sm text-ink-muted">
          No deals yet. <Link href="/deals/new" className="font-medium text-brand underline">Create the first deal</Link>.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="tbl">
              <thead>
                <tr>
                  {['Address', 'Market', 'ZIP', 'Purchase', 'Base ARV', 'All-in', 'Equity', 'Cash Left', 'DSCR', 'Mo. CF', 'Flip Profit', 'Score', 'Rec.', 'Status', 'Updated'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ d, a }) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="min-w-[150px] max-w-[190px] whitespace-normal font-medium">
                      <Link href={`/deals/${d.id}`} className="text-brand hover:underline">{d.inputs.address}</Link>
                    </td>
                    <td>{d.inputs.market ?? '—'}</td>
                    <td>{d.inputs.zip ?? '—'}</td>
                    <td><Val v={money(d.inputs.purchasePrice)} /></td>
                    <td><Val v={money(d.inputs.arvBase)} /></td>
                    <td><Val v={money(a.base.totalProjectCost)} /></td>
                    <td><Val v={money(a.base.equityCreated)} /></td>
                    <td><Val v={money(a.base.refi.cashLeftInDeal)} /></td>
                    <td><Val v={dscrText(a.base.refi.dscr, a.base.refi.annualDebtService)} /></td>
                    <td><Val v={money(a.base.refi.monthlyCashFlow)} /></td>
                    <td><Val v={money(a.base.flip.netProfit)} /></td>
                    <td className="font-semibold">{a.score.total}{!a.score.complete && <span className="text-amber-700" title="Incomplete">*</span>}</td>
                    <td><RecBadge rec={a.recommendation.recommendation} /></td>
                    <td>{d.status}</td>
                    <td className="text-ink-muted" title={shortDate(d.updatedAt)}>{shortDate(d.updatedAt).replace(/, \d{4}$/, '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-ink-muted">* score incomplete — some inputs are UNKNOWN</p>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map(({ d, a }) => (
              <li key={d.id}>
                <Link href={`/deals/${d.id}`} className="card block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-brand">{d.inputs.address}</div>
                      <div className="text-xs text-ink-muted">
                        {[d.inputs.market, d.inputs.zip].filter(Boolean).join(' · ')} · {d.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{a.score.total}{!a.score.complete && '*'}</div>
                      <RecBadge rec={a.recommendation.recommendation} />
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Mini k="Purchase" v={money(d.inputs.purchasePrice)} />
                    <Mini k="All-in" v={money(a.base.totalProjectCost)} />
                    <Mini k="Equity" v={money(a.base.equityCreated)} />
                    <Mini k="Cash Left" v={money(a.base.refi.cashLeftInDeal)} />
                    <Mini k="DSCR" v={dscrText(a.base.refi.dscr, a.base.refi.annualDebtService)} />
                    <Mini k="Flip" v={money(a.base.flip.netProfit)} />
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-ink-muted">{k}</dt>
      <dd className="font-medium tabular-nums"><Val v={v} /></dd>
    </div>
  )
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: readonly string[] }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? ''} className="input">
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}
