import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CompForm } from '@/components/CompForm'
import { CompsList } from '@/components/CompsList'
import { CompsStats } from '@/components/CompsStats'
import { Val } from '@/components/Val'
import { compArv, compStats, summaryFromComps, type CompSummaryKey } from '@/engine/comps'
import { CompArvPanel } from '@/components/CompArvPanel'
import { fieldLabel } from '@/engine/fields'
import { compsRepo } from '@/lib/comps-repo'
import { compToForm } from '@/lib/comps/parse-comp'
import { getDb } from '@/lib/db'
import { dealsRepo } from '@/lib/deals-repo'
import { money, num } from '@/lib/format'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const SUMMARY_FORMAT: Record<CompSummaryKey, (v: number | null) => string> = {
  compCount: (v) => num(v),
  compAvgPrice: (v) => money(v),
  compMedianPrice: (v) => money(v),
  compDistanceMiles: (v) => (v === null ? 'UNKNOWN' : `${num(v, 2)} mi`),
  compRecencyMonths: (v) => (v === null ? 'UNKNOWN' : `${num(v, 1)} mo`),
  compRenovatedCount: (v) => num(v),
  compUnrenovatedCount: (v) => num(v),
}

export default async function CompsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const { edit } = await searchParams
  const db = await getDb()
  const deal = await dealsRepo(db).get(id)
  if (!deal) notFound()
  const repo = compsRepo(db)
  const comps = await repo.list(id)
  const editing = edit ? comps.find((c) => c.id === edit) : undefined
  const now = new Date()
  const stats = compStats(comps, now)
  const arvResult = compArv(comps, { sqft: deal.inputs.sqft, beds: deal.inputs.beds, baths: deal.inputs.baths }, now)
  const summary = summaryFromComps(stats)
  const keys = Object.keys(summary) as CompSummaryKey[]
  const differs = keys.filter((k) => summary[k] !== deal.inputs[k])
  const i = deal.inputs

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/deals/${id}`} className="text-xs text-ink-muted hover:underline">← Back to deal</Link>
        <h1 className="text-xl font-semibold">Comparable properties — {i.address}</h1>
        <p className="text-sm text-ink-muted">
          Subject: {[i.beds !== null && `${i.beds} bd`, i.baths !== null && `${i.baths} ba`, i.sqft !== null && `${i.sqft.toLocaleString('en-US')} sqft`].filter(Boolean).join(' · ') || 'beds/baths/sqft unknown'}
          {' · '}ARV (Conservative / Base / Upside): {money(i.arvConservative)} / {money(i.arvBase)} / {money(i.arvUpside)}
        </p>
      </div>

      <section className="card">
        <h2 className="h2">Comp-supported ARV</h2>
        <CompArvPanel r={arvResult} baseArv={i.arvBase} dealId={id} canApply={Boolean(user)} />
      </section>

      <section className="card">
        <h2 className="h2">Comp statistics</h2>
        <CompsStats s={stats} />
        <p className="mt-2 text-xs text-ink-muted">
          Statistics summarise the comps only. Base ARV changes only when you click “Apply” above.
        </p>
      </section>

      <section className="card">
        <h2 className="h2">Comps ({comps.length})</h2>
        <CompsList comps={comps} editable={Boolean(user)} />
      </section>

      {user && <CompForm key={editing?.id ?? 'new'} dealId={id} compId={editing?.id} initial={editing ? compToForm(editing) : {}} />}

      <section className="card">
        <h2 className="h2">Deal comp summary</h2>
        <p className="mb-2 text-xs text-ink-muted">
          The deal&apos;s comp summary fields (§8) are kept in sync with this list automatically (each change is in the
          audit trail). Distance = farthest comp; recency = oldest sale.
        </p>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr><th>Field</th><th>On the deal</th><th>From this list</th></tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k} className={differs.includes(k) ? 'bg-amber-50' : ''}>
                  <td>{fieldLabel(k)}</td>
                  <td><Val v={SUMMARY_FORMAT[k](i[k])} /></td>
                  <td className="font-medium"><Val v={SUMMARY_FORMAT[k](summary[k])} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
