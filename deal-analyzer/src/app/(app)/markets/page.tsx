import Link from 'next/link'
import { addGeography, evaluateNow } from '@/app/market-actions'
import { ActionForm } from '@/components/ActionForm'
import { getDb } from '@/lib/db'
import { dateTime } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { DIMENSION_LABELS, type DimensionKey } from '@/market/engine/config'
import { GEO_LEVEL_LABELS } from '@/market/engine/types'
import { marketRows, type MarketRow } from '@/market/lib/service'
import { DecisionBadge, RiskText } from '@/market/ui/Badges'
import { priorityText, score, signed } from '@/market/ui/format'

export const dynamic = 'force-dynamic'

const DIMS: DimensionKey[] = ['marketQuality', 'opportunityDensity', 'capitalEfficiency', 'strategyFit']
const SHORT: Record<DimensionKey, string> = { marketQuality: 'Quality', opportunityDensity: 'Opportunity', capitalEfficiency: 'Capital eff.', strategyFit: 'Strategy fit' }

export default async function MarketsPage() {
  await requireUser()
  const rows = await marketRows(await getDb())
  const msas = rows.filter((r) => r.geo.level === 'msa')
  const children = rows.filter((r) => r.geo.level !== 'msa' && r.geo.level !== 'country')
  const lastRun = rows.map((r) => r.latest?.createdAt).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Market Intelligence</h1>
          <p className="max-w-3xl text-sm text-ink-soft">
            Where ValeForge should search, for which opportunities and with which strategy. Scores are percentiles against
            peer markets (0–100); a <strong>range</strong> means the evidence is too thin for a precise number or rank.
            Market decisions are KEEP / WATCH / DROP / DRILL DOWN — property-level BUY / INVESTIGATE / PASS stays in the Deal
            Analyzer. This list is a research queue, not a list of winners.
          </p>
        </div>
        <form action={evaluateNow} className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">{lastRun ? `Last evaluated ${dateTime(lastRun)}` : 'Not evaluated yet'}</span>
          <button className="btn-primary">Evaluate now</button>
        </form>
      </div>

      <MarketTable title="Markets (MSA)" rows={msas} empty="No markets yet. Add a few MSAs below to build the research queue." />
      {children.length > 0 && <MarketTable title="Drill-down geographies (submarkets, ZIPs)" rows={children} empty="" showLevel />}

      <section className="card max-w-xl">
        <h2 className="h2">Add a market (MSA)</h2>
        <p className="mb-2 text-xs text-ink-muted">
          Use the official CBSA code (e.g. 19100). Submarkets and ZIPs are added from a market&apos;s page once it has been
          promoted for drill-down.
        </p>
        <ActionForm action={addGeography} submitLabel="Add market" className="grid grid-cols-2 gap-2">
          <input type="hidden" name="level" value="msa" />
          <div>
            <label className="label" htmlFor="code">CBSA code</label>
            <input id="code" name="code" className="input" inputMode="numeric" pattern="\d{5}" required />
          </div>
          <div>
            <label className="label" htmlFor="state">Principal state</label>
            <input id="state" name="state" className="input" maxLength={2} placeholder="TX" required />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="name">Name (blank = look up from the Census, needs CENSUS_API_KEY)</label>
            <input id="name" name="name" className="input" placeholder="Dallas-Fort Worth-Arlington, TX" />
          </div>
        </ActionForm>
      </section>
    </div>
  )
}

function MarketTable({ title, rows, empty, showLevel }: { title: string; rows: MarketRow[]; empty: string; showLevel?: boolean }) {
  const sorted = [...rows].sort((a, b) => (b.latest?.result.priority.point ?? -1) - (a.latest?.result.priority.point ?? -1))
  return (
    <section className="card overflow-x-auto">
      <h2 className="h2">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Market</th>
              {showLevel && <th>Level</th>}
              <th title="Core Market Priority × risk modifier">Core score</th>
              {DIMS.map((d) => (
                <th key={d} title={DIMENSION_LABELS[d]}>{SHORT[d]}</th>
              ))}
              <th>Risk</th>
              <th>Confidence</th>
              <th>Freshness</th>
              <th>Status</th>
              <th>Last updated</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ geo, latest, change, analyzable }) => {
              const e = latest?.result
              return (
                <tr key={geo.id}>
                  <td className="font-medium">
                    <Link href={`/markets/${encodeURIComponent(geo.id)}`} className="text-brand underline-offset-2 hover:underline">
                      {geo.name}
                    </Link>
                    {e?.priority.rank && <span className="ml-1 text-xs text-ink-muted">#{e.priority.rank}</span>}
                  </td>
                  {showLevel && <td className="text-xs">{GEO_LEVEL_LABELS[geo.level]}</td>}
                  {!e ? (
                    <td colSpan={10} className="text-xs text-ink-muted">
                      {analyzable ? 'Not evaluated yet — load data, then Evaluate now.' : 'Waiting for the parent to be promoted.'}
                    </td>
                  ) : (
                    <>
                      <td className="font-semibold">{priorityText(e.priority)}</td>
                      {DIMS.map((d) => (
                        <td key={d} title={`completeness ${Math.round(e.dimensions[d].completeness * 100)}%`}>
                          {score(e.dimensions[d].point)}
                          {e.dimensions[d].completeness < 1 && e.dimensions[d].point !== null && <span className="unknown">*</span>}
                        </td>
                      ))}
                      <td>
                        <RiskText level={e.risk.level} />
                      </td>
                      <td>
                        {e.confidence.label} ({e.confidence.score.toFixed(0)})
                      </td>
                      <td>{e.freshness.score === null ? 'UNKNOWN' : e.freshness.score.toFixed(0)}</td>
                      <td>
                        <DecisionBadge state={e.decision.state} />
                      </td>
                      <td className="text-xs">{dateTime(latest!.createdAt)}</td>
                      <td className="text-xs">
                        {change ? (change.delta === null ? (change.decision ? `${change.decision.from} → ${change.decision.to}` : '—') : signed(change.delta)) : 'first snapshot'}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-xs text-ink-muted">* part of that dimension&apos;s evidence is missing (scored on what is known; see the market page for bounds).</p>
    </section>
  )
}
