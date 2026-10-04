import { notFound } from 'next/navigation'
import { AnalysisView } from '@/components/AnalysisView'
import { PrintButton } from '@/components/PrintButton'
import { analyzeDeal } from '@/engine/analyze'
import { FIELD_SECTIONS } from '@/engine/fields'
import { describeAuditValue } from '@/lib/audit-format'
import { dateTime } from '@/lib/format'
import { NOTE_CATEGORIES } from '@/lib/notes'
import { repo } from '@/lib/repo'
import { CompsList } from '@/components/CompsList'
import { CompsStats } from '@/components/CompsStats'
import { compStats } from '@/engine/comps'
import { compsRepo } from '@/lib/comps-repo'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** §34 Export — print-optimised report; "Save as PDF" from the browser print dialog. */
export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await (await repo()).get(id)
  if (!deal) notFound()
  const a = analyzeDeal(deal.inputs)
  const i = deal.inputs
  const comps = await compsRepo(await getDb()).list(id)

  return (
    <article className="space-y-4">
      <div className="no-print flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 text-sm">
        <span>Print-ready report. Use your browser&apos;s “Save as PDF”.</span>
        <PrintButton />
      </div>

      <header className="border-b border-slate-300 pb-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-ink-muted">ValeForge · Deal underwriting report</div>
        <h1 className="text-2xl font-bold">{i.address}</h1>
        <p className="text-sm text-ink-soft">
          {[i.city, i.state, i.zip].filter(Boolean).join(', ')} · Status: {deal.status} · Generated {dateTime(new Date())}
        </p>
      </header>

      <AnalysisView a={a} inputs={deal.inputs} />

      <section className="card">
        <h2 className="h2">Comparable properties ({comps.length})</h2>
        {comps.length > 0 && <CompsStats s={compStats(comps, new Date())} />}
        <div className="mt-3"><CompsList comps={comps} /></div>
      </section>

      <section className="card">
        <h2 className="h2">Inputs</h2>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELD_SECTIONS.map((s) => (
            <div key={s.id} className="break-inside-avoid">
              <h3 className="mb-1 text-sm font-semibold">{s.title}</h3>
              <table className="tbl">
                <tbody>
                  {s.fields.map((f) => {
                    const text = f.kind === 'gate' ? String(i[f.key]) : describeAuditValue(f.key, i[f.key])
                    return (
                      <tr key={f.key}>
                        <td className="whitespace-normal text-ink-soft">{f.label}</td>
                        <td className={`text-right ${text === 'Unknown' || text === 'unknown' ? 'unknown' : ''}`}>
                          {text === 'unknown' ? 'Unknown' : text}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {NOTE_CATEGORIES.some((n) => deal.notes[n.key]) && (
        <section className="card">
          <h2 className="h2">Notes</h2>
          {NOTE_CATEGORIES.filter((n) => deal.notes[n.key]).map((n) => (
            <div key={n.key} className="mb-2 text-sm">
              <div className="font-medium">{n.label}</div>
              <div className="whitespace-pre-wrap text-ink-soft">{deal.notes[n.key]}</div>
            </div>
          ))}
        </section>
      )}
    </article>
  )
}
