import Link from 'next/link'
import { createCandidate, handOffCandidate, rejectCandidate } from '@/app/market-actions'
import { ActionForm } from '@/components/ActionForm'
import { PROPERTY_TYPES } from '@/engine/types'
import { getDb } from '@/lib/db'
import { money } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { GEO_LEVEL_LABELS } from '@/market/engine/types'
import { avatarsRepo, candidatesRepo, geoRepo, promotionsRepo } from '@/market/lib/repo'
import { analyzable } from '@/market/lib/service'

export const dynamic = 'force-dynamic'

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ geoId?: string; status?: string }> }) {
  await requireUser()
  const { geoId, status } = await searchParams
  const db = await getDb()
  const [candidates, geos, avatars, promotions] = await Promise.all([
    candidatesRepo(db).list({ status: status || undefined }),
    geoRepo(db).list(),
    avatarsRepo(db).list({ activeOnly: true }),
    promotionsRepo(db).active(),
  ])
  const byId = new Map(geos.map((g) => [g.id, g]))
  const promoted = new Set(promotions.keys())
  const usable = geos.filter((g) => analyzable(g, byId, promoted))
  const avatarName = new Map(avatars.map((a) => [a.id, a.name]))
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Candidates</h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          A candidate is a specific property that deserves underwriting — not a market and not a deal. <strong>Send to Deal Analyzer</strong>{' '}
          creates a deal with the property facts and asking price; ARV, rehab and rent estimates go to the deal notes (not applied):
          the Deal Analyzer decides BUY / INVESTIGATE / PASS.
        </p>
      </div>
      <nav className="flex gap-2 text-sm">
        {['', 'new', 'handed_off', 'rejected'].map((s) => (
          <Link key={s} href={s ? `/markets/candidates?status=${s}` : '/markets/candidates'} className={`rounded px-2 py-1 ${status === s || (!status && !s) ? 'bg-brand text-white' : 'border border-slate-300'}`}>
            {s === '' ? 'All' : s.replace('_', ' ')}
          </Link>
        ))}
      </nav>
      <section className="card overflow-x-auto">
        {candidates.length === 0 ? (
          <p className="text-sm text-ink-muted">No candidates.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Address</th>
                <th>Geography</th>
                <th>Avatar</th>
                <th>Type</th>
                <th>Asking</th>
                <th>Est. ARV / rehab / rent</th>
                <th>Source</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.address}</td>
                  <td className="text-xs">
                    <Link href={`/markets/${encodeURIComponent(c.geoId)}`} className="underline">{byId.get(c.geoId)?.name ?? c.geoId}</Link>
                  </td>
                  <td className="text-xs">{c.avatarId ? avatarName.get(c.avatarId) ?? '—' : '—'}</td>
                  <td>{c.propertyType ?? 'UNKNOWN'} {c.beds !== null && `${c.beds} BR`}</td>
                  <td>{money(c.askingPrice)}</td>
                  <td className="text-xs">
                    {money(c.estArv)} / {money(c.estRehab)} / {c.estRent === null ? 'UNKNOWN' : `${money(c.estRent)}/mo`}
                  </td>
                  <td className="max-w-[12rem] truncate text-xs" title={c.source}>{c.source}</td>
                  <td>
                    {c.status === 'handed_off' && c.dealId ? (
                      <Link href={`/deals/${c.dealId}`} className="text-brand underline">Deal →</Link>
                    ) : (
                      c.status.replace('_', ' ')
                    )}
                  </td>
                  <td className="flex gap-1">
                    {c.status === 'new' && (
                      <>
                        <form action={handOffCandidate}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="version" value={c.version} />
                          <button className="btn-primary min-h-[36px] py-1">Send to Deal Analyzer</button>
                        </form>
                        <form action={rejectCandidate}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="version" value={c.version} />
                          <button className="btn-secondary min-h-[36px] py-1">Reject</button>
                        </form>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card max-w-3xl">
        <h2 className="h2">Add a candidate</h2>
        {usable.length === 0 ? (
          <p className="text-sm text-ink-muted">Add a market first (Markets → Add a market).</p>
        ) : (
          <ActionForm action={createCandidate} submitLabel="Add candidate" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="col-span-2">
              <label className="label" htmlFor="c-geo">Geography</label>
              <select id="c-geo" name="geoId" className="input" defaultValue={geoId ?? ''} required>
                <option value="">Choose…</option>
                {usable.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({GEO_LEVEL_LABELS[g.level]})</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="c-avatar">Avatar</label>
              <select id="c-avatar" name="avatarId" className="input">
                <option value="">None</option>
                {avatars.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="c-addr">Address</label>
              <input id="c-addr" name="address" className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="c-city">City</label>
              <input id="c-city" name="city" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="c-zip">ZIP</label>
              <input id="c-zip" name="zip" className="input" inputMode="numeric" />
            </div>
            <div>
              <label className="label" htmlFor="c-type">Property type</label>
              <select id="c-type" name="propertyType" className="input">
                <option value="">UNKNOWN</option>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            {(
              [
                ['beds', 'Beds'],
                ['baths', 'Baths'],
                ['sqft', 'Sq ft'],
                ['yearBuilt', 'Year built'],
                ['askingPrice', 'Asking price ($)'],
                ['estArv', 'Est. ARV ($)'],
                ['estRehab', 'Est. rehab ($)'],
                ['estRent', 'Est. rent ($/mo)'],
              ] as const
            ).map(([k, l]) => (
              <div key={k}>
                <label className="label" htmlFor={`c-${k}`}>{l}</label>
                <input id={`c-${k}`} name={k} className="input" inputMode="decimal" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="label" htmlFor="c-cond">Condition</label>
              <input id="c-cond" name="condition" className="input" />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="c-src">Source (required)</label>
              <input id="c-src" name="source" className="input" placeholder="e.g. Agent off-market list" required />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="c-url">Source URL</label>
              <input id="c-url" name="sourceUrl" className="input" placeholder="https://…" />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="c-notes">Notes</label>
              <input id="c-notes" name="notes" className="input" />
            </div>
          </ActionForm>
        )}
      </section>
    </div>
  )
}
