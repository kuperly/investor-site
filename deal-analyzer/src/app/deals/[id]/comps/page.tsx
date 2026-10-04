import Link from 'next/link'
import { notFound } from 'next/navigation'
import { applyCompSummary } from '@/app/comps-actions'
import { CompForm } from '@/components/CompForm'
import { CompsList } from '@/components/CompsList'
import { CompsStats } from '@/components/CompsStats'
import { Val } from '@/components/Val'
import { compStats, summaryFromComps, type CompSummaryKey } from '@/engine/comps'
import { fieldLabel } from '@/engine/fields'
import { compsRepo } from '@/lib/comps-repo'
import { compToForm } from '@/lib/comps/parse-comp'
import { getDb } from '@/lib/db'
import { dealsRepo } from '@/lib/deals-repo'
import { money, num } from '@/lib/format'
import { currentUser } from '@/lib/session'

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
  const { id } = await params
  const { edit } = await searchParams
  const db = await getDb()
  const deal = await dealsRepo(db).get(id)
  if (!deal) notFound()
  const repo = compsRepo(db)
  const [comps, user] = await Promise.all([repo.list(id), currentUser()])
  const editing = edit ? comps.find((c) => c.id === edit) : undefined
  const stats = compStats(comps, new Date())
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
        <h2 className="h2">Comp statistics</h2>
        <CompsStats s={stats} />
        <p className="mt-2 text-xs text-ink-muted">
          Statistics summarise the comps only — the ARVs remain your decision and are never set from this list.
        </p>
      </section>

      <section className="card">
        <h2 className="h2">Comps ({comps.length})</h2>
        <CompsList comps={comps} editable={Boolean(user)} />
        {!user && <p className="mt-2 text-xs text-amber-800">Select Guy or Ben in the header to add or edit comps.</p>}
      </section>

      {user && <CompForm key={editing?.id ?? 'new'} dealId={id} compId={editing?.id} initial={editing ? compToForm(editing) : {}} />}

      <section className="card">
        <h2 className="h2">Deal comp summary</h2>
        <p className="mb-2 text-xs text-ink-muted">
          The deal&apos;s comp summary fields (§8) next to what this list says. Distance = farthest comp; recency = oldest sale.
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
        {user && differs.length > 0 && comps.length > 0 && (
          <form action={applyCompSummary} className="mt-3">
            <input type="hidden" name="dealId" value={id} />
            <button className="btn-primary">Apply list values to deal ({differs.length} field{differs.length === 1 ? '' : 's'})</button>
            <span className="ml-2 text-xs text-ink-muted">Each change is recorded in the audit trail.</span>
          </form>
        )}
      </section>
    </div>
  )
}
