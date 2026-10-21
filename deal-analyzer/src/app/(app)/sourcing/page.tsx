import Link from 'next/link'
import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { DecisionBadge } from '@/market/ui/Badges'
import type { DecisionState } from '@/market/engine/evaluate'
import { LAYERS } from '@/sourcing/engine/layers'
import { pipeline } from '@/sourcing/lib/service'

export const dynamic = 'force-dynamic'

const MODULE_STYLE: Record<string, string> = {
  'Market Intelligence': 'border-sky-300 bg-sky-50',
  'Deal Sourcing': 'border-amber-300 bg-amber-50',
  'Deal Analyzer': 'border-emerald-300 bg-emerald-50',
}

export default async function PipelinePage() {
  await requireUser()
  const { rows, targets } = await pipeline(await getDb())
  const total = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0)
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          How deals are found: one chain of layers. Markets decide <em>where</em>, sourcing decides <em>what to chase</em>, the
          Deal Analyzer decides <em>whether and at what price</em>. Work moves down only through each layer&apos;s gate, so
          every deal can be traced back to the market decision that justified looking there.
        </p>
      </div>

      <section aria-label="Operating layers" className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {LAYERS.map((l) => (
          <Link key={l.key} href={l.href} className={`block rounded-lg border p-3 text-sm hover:shadow ${MODULE_STYLE[l.module]}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Layer {l.n} · {l.module}
            </div>
            <div className="font-semibold">{l.name}</div>
            <div className="mt-1 text-xs text-ink-soft">{l.question}</div>
            <div className="mt-1 text-xs">
              <span className="font-medium">Gate in:</span> {l.entryGate}
            </div>
            <div className="mt-1 text-xs">
              <span className="font-medium">Out:</span> {l.output}
            </div>
          </Link>
        ))}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="h2">Funnel by market</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing in the pipeline yet. Start at <Link href="/markets" className="underline">Market Intelligence</Link>: evaluate,
            then open a sourcing target on a KEEP or DRILL DOWN market.
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Market</th>
                <th>Decision</th>
                <th title="Layer 3">Active targets</th>
                <th title="Layer 4">Leads</th>
                <th>Fit / incomplete / outside</th>
                <th>Rejected</th>
                <th title="Layer 5">In Deal Analyzer</th>
                <th>BUY / INVESTIGATE / PASS</th>
                <th title="Layer 6">Closed · with actuals</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.marketId}>
                  <td className="font-medium">
                    <Link href={`/markets/${encodeURIComponent(r.marketId)}`} className="text-brand underline">{r.market?.name ?? r.marketId}</Link>
                  </td>
                  <td>{r.decision ? <DecisionBadge state={r.decision as DecisionState} /> : 'UNKNOWN'}</td>
                  <td>{r.targets}</td>
                  <td>{r.leads}</td>
                  <td>{r.screenPass} / {r.screenIncomplete} / {r.screenFail}</td>
                  <td>{r.rejected}</td>
                  <td>{r.handedOff}</td>
                  <td>{r.buy} / {r.investigate} / {r.pass}</td>
                  <td>{r.closed} · {r.outcomes}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td>Total</td>
                <td />
                <td>{total('targets')}</td>
                <td>{total('leads')}</td>
                <td>{total('screenPass')} / {total('screenIncomplete')} / {total('screenFail')}</td>
                <td>{total('rejected')}</td>
                <td>{total('handedOff')}</td>
                <td>{total('buy')} / {total('investigate')} / {total('pass')}</td>
                <td>{total('closed')} · {total('outcomes')}</td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          BUY / INVESTIGATE / PASS is the Deal Analyzer&apos;s current recommendation for each deal that came from a lead ({targets.length} target
          {targets.length === 1 ? '' : 's'} on file).
        </p>
      </section>
    </div>
  )
}
