import Link from 'next/link'
import { notFound } from 'next/navigation'
import { setStatus } from '@/app/actions'
import { AnalysisView } from '@/components/AnalysisView'
import { analyzeDeal } from '@/engine/analyze'
import { fieldLabel } from '@/engine/fields'
import { DEAL_STATUSES, type InputKey } from '@/engine/types'
import { dateTime } from '@/lib/format'
import { NOTE_CATEGORIES } from '@/lib/notes'
import { repo } from '@/lib/repo'
import { currentUser } from '@/lib/session'
import { describeAuditValue, describeCompAudit } from '@/lib/audit-format'
import { CompsStats } from '@/components/CompsStats'
import { compArv, compStats } from '@/engine/comps'
import { CompArvPanel } from '@/components/CompArvPanel'
import { compsRepo } from '@/lib/comps-repo'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await repo()
  const deal = await r.get(id)
  if (!deal) notFound()
  const [audit, user, comps] = await Promise.all([r.audit(id), currentUser(), compsRepo(await getDb()).list(id)])
  const now = new Date()
  const stats = compStats(comps, now)
  const arvResult = compArv(comps, { sqft: deal.inputs.sqft, beds: deal.inputs.beds, baths: deal.inputs.baths }, now)
  const a = analyzeDeal(deal.inputs, { compArv: arvResult.arv })
  const i = deal.inputs
  const notes = NOTE_CATEGORIES.filter((n) => deal.notes[n.key])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/" className="no-print text-xs text-ink-muted hover:underline">← All deals</Link>
          <h1 className="text-xl font-semibold">{i.address}</h1>
          <p className="text-sm text-ink-muted">
            {[i.city, i.state, i.zip].filter(Boolean).join(', ')}
            {i.market ? ` · ${i.market}` : ''}
            {i.propertyType ? ` · ${i.propertyType}` : ''}
            {i.beds !== null ? ` · ${i.beds} bd` : ''}
            {i.baths !== null ? ` / ${i.baths} ba` : ''}
            {i.sqft !== null ? ` · ${i.sqft.toLocaleString('en-US')} sqft` : ''}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <form action={setStatus} className="flex items-center gap-1">
            <input type="hidden" name="id" value={deal.id} />
            <label htmlFor="status" className="sr-only">Status</label>
            <select id="status" name="status" defaultValue={deal.status} className="input w-auto" disabled={!user}>
              {DEAL_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button className="btn-secondary" disabled={!user} title={user ? undefined : 'Select a user first'}>Set</button>
          </form>
          <Link href={`/deals/${deal.id}/edit`} className="btn-primary">Edit</Link>
          <Link href={`/deals/${deal.id}/export`} className="btn-secondary">Export Deal</Link>
        </div>
      </div>

      <AnalysisView a={a} inputs={deal.inputs} defaulted={deal.defaulted} />

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Comparable properties ({comps.length})</h2>
          <Link href={`/deals/${deal.id}/comps`} className="btn-secondary no-print">Manage comps</Link>
        </div>
        {comps.length === 0 ? (
          <p className="text-sm text-ink-muted">No comps on file yet. Add them to back up the ARVs.</p>
        ) : (
          <div className="space-y-4">
            <CompArvPanel r={arvResult} baseArv={deal.inputs.arvBase} dealId={deal.id} canApply={Boolean(user)} compact />
            <CompsStats s={stats} />
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">Deal notes</h2>
          {notes.length === 0 ? (
            <p className="text-sm text-ink-muted">No notes yet.</p>
          ) : (
            <dl className="space-y-3 text-sm">
              {notes.map((n) => (
                <div key={n.key}>
                  <dt className="font-medium">{n.label}</dt>
                  <dd className="whitespace-pre-wrap text-ink-soft">{deal.notes[n.key]}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="card">
          <h2 className="h2">Audit trail</h2>
          <ol className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {audit.map((e) => (
              <li key={e.id} className="border-b border-slate-100 pb-2">
                {e.field === 'created' ? (
                  <div className="font-medium">Deal created</div>
                ) : e.field === 'comps' ? (
                  (() => {
                    const d = describeCompAudit(e.oldValue, e.newValue)
                    return (
                      <>
                        <div className="font-medium">{d.title}</div>
                        <div className="text-ink-soft">{d.detail}</div>
                      </>
                    )
                  })()
                ) : (
                  <>
                    <div className="font-medium">{labelFor(e.field)}</div>
                    <div className="text-ink-soft">
                      Old: {describeAuditValue(e.field, e.oldValue)} → New: {describeAuditValue(e.field, e.newValue)}
                    </div>
                  </>
                )}
                <div className="text-xs text-ink-muted">Changed by {e.changedBy} · {dateTime(e.changedAt)}</div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

function labelFor(field: string): string {
  if (field === 'status') return 'Status'
  if (field.startsWith('notes.')) return NOTE_CATEGORIES.find((n) => `notes.${n.key}` === field)?.label ?? field
  return fieldLabel(field as InputKey)
}
