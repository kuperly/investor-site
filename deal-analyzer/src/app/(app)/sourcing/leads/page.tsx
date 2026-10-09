import Link from 'next/link'
import { addLeadAction, handOffLead, importLeadsAction, rejectLead, rescreenLead, setTargetStatus } from '@/app/sourcing-actions'
import { ActionForm } from '@/components/ActionForm'
import { PROPERTY_TYPES } from '@/engine/types'
import { getDb } from '@/lib/db'
import { money } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { settingsRepo } from '@/lib/settings-repo'
import { GEO_LEVEL_LABELS } from '@/market/engine/types'
import { avatarsRepo, geoRepo } from '@/market/lib/repo'
import { handoffGate } from '@/sourcing/engine/gates'
import { LEAD_COLUMNS, MAX_IMPORT_ROWS } from '@/sourcing/engine/leads'
import { indicativeCheck, type ScreenOverall } from '@/sourcing/engine/screen'
import { candidatesRepo, targetsRepo } from '@/sourcing/lib/repo'

export const dynamic = 'force-dynamic'

const SCREEN_STYLE: Record<ScreenOverall, string> = {
  pass: 'bg-emerald-100 text-emerald-900',
  incomplete: 'bg-amber-100 text-amber-900',
  fail: 'bg-rose-100 text-rose-900',
  no_buy_box: 'bg-slate-100 text-slate-800',
}
const SCREEN_LABEL: Record<ScreenOverall, string> = { pass: 'Fits buy box', incomplete: 'Incomplete', fail: 'Outside buy box', no_buy_box: 'No buy box' }

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ targetId?: string; status?: string }> }) {
  await requireUser()
  const { targetId, status } = await searchParams
  const db = await getDb()
  const [targets, geos, avatars, defaults] = await Promise.all([targetsRepo(db).list(), geoRepo(db).list(), avatarsRepo(db).list(), settingsRepo(db).getDefaults()])
  const target = targetId ? targets.find((t) => t.id === targetId) : undefined
  const leads = await candidatesRepo(db).list({ targetId: target?.id, status: status || undefined })
  const geo = new Map(geos.map((g) => [g.id, g]))
  const avatarName = new Map(avatars.map((a) => [a.id, a.name]))
  const tLabel = (t: (typeof targets)[number]) => `${geo.get(t.geoId)?.name ?? t.geoId} × ${t.avatarId ? (avatarName.get(t.avatarId) ?? 'buy box') : 'no buy box'}`
  const active = targets.filter((t) => t.status === 'active')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Leads <span className="text-sm font-normal text-ink-muted">· layer 4</span></h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          Specific properties found under a sourcing target. Each lead is screened against its target&apos;s buy box (the
          avatar&apos;s own ranges) and given an <strong>indicative</strong> check: the Deal Analyzer engine on the lead&apos;s
          estimates plus ValeForge defaults. That is a triage aid, not underwriting — BUY / INVESTIGATE / PASS happens only
          after <strong>Send to Deal Analyzer</strong> (layer 5).
        </p>
      </div>

      <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Filter leads">
        <form className="flex items-center gap-2">
          <select name="targetId" defaultValue={target?.id ?? ''} className="input w-auto" aria-label="Target">
            <option value="">All targets</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{tLabel(t)} ({t.status})</option>
            ))}
          </select>
          <select name="status" defaultValue={status ?? ''} className="input w-auto" aria-label="Status">
            <option value="">Any status</option>
            <option value="new">Open</option>
            <option value="handed_off">Sent to Deal Analyzer</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="btn-secondary">Filter</button>
        </form>
        {(target || status) && <Link href="/sourcing/leads" className="underline">Clear</Link>}
      </nav>

      {target && (
        <section className="card flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            <strong>Target:</strong> {tLabel(target)} · <span className="font-semibold">{target.status}</span> · opened under {target.gateDecision} by {target.createdBy}
            {target.overrideReason && <> — reason: “{target.overrideReason}”</>}
            {' · '}
            <Link href={`/markets/${encodeURIComponent(target.geoId)}`} className="underline">market page</Link>
          </div>
          <div className="flex gap-1">
            {(['active', 'paused', 'closed'] as const)
              .filter((s) => s !== target.status)
              .map((s) => (
                <form key={s} action={setTargetStatus}>
                  <input type="hidden" name="id" value={target.id} />
                  <input type="hidden" name="version" value={target.version} />
                  <input type="hidden" name="status" value={s} />
                  <button className="btn-secondary min-h-[36px] py-1">{s === 'active' ? 'Reactivate' : s === 'paused' ? 'Pause' : 'Close'}</button>
                </form>
              ))}
          </div>
        </section>
      )}

      <section className="card overflow-x-auto">
        {leads.length === 0 ? (
          <p className="text-sm text-ink-muted">No leads{target ? ' under this target yet' : ''}.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Address</th>
                <th>Area</th>
                <th>Type</th>
                <th>Asking</th>
                <th>Est. ARV / rehab / rent</th>
                <th>Buy-box screen</th>
                <th title="Deal Analyzer engine on the lead's estimates + ValeForge defaults">Indicative check</th>
                <th>Source</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leads.map((c) => {
                const sc = c.screening
                const gate = handoffGate(sc?.overall ?? null)
                const ind = c.status === 'new' ? indicativeCheck(c, defaults) : null
                return (
                  <tr key={c.id} className="align-top">
                    <td className="font-medium">{c.address}</td>
                    <td className="text-xs">
                      <Link href={`/markets/${encodeURIComponent(c.geoId)}`} className="underline">{geo.get(c.geoId)?.name ?? c.geoId}</Link>
                    </td>
                    <td>
                      {c.propertyType ?? 'UNKNOWN'}
                      {c.beds !== null && ` · ${c.beds} BR`}
                    </td>
                    <td>{money(c.askingPrice)}</td>
                    <td className="text-xs">
                      {money(c.estArv)} / {money(c.estRehab)} / {c.estRent === null ? 'UNKNOWN' : `${money(c.estRent)}/mo`}
                    </td>
                    <td className="whitespace-normal text-xs">
                      {sc ? (
                        <details>
                          <summary className={`inline-block cursor-pointer rounded px-1.5 py-0.5 font-semibold ${SCREEN_STYLE[sc.overall]}`}>{SCREEN_LABEL[sc.overall]}</summary>
                          <ul className="mt-1 space-y-0.5">
                            {sc.criteria.map((k) => (
                              <li key={k.label} className={k.result === 'fail' ? 'text-rose-800' : k.result === 'unknown' ? 'text-amber-800' : ''}>
                                {k.result === 'pass' ? '✓' : k.result === 'fail' ? '✗' : '?'} {k.label}: {k.detail}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <span className={`rounded px-1.5 py-0.5 ${SCREEN_STYLE.no_buy_box}`}>Not screened</span>
                      )}
                    </td>
                    <td className="whitespace-normal text-xs">
                      {ind ? (
                        <>
                          <div>All-in {money(ind.allIn)}{ind.incomplete && '*'} · equity {money(ind.equity)}</div>
                          <div>
                            Max Offer {money(ind.maxOfferBase)}
                            {ind.askingOverMaxOffer !== null && (
                              <span className={ind.askingOverMaxOffer > 0 ? 'text-rose-800' : 'text-emerald-800'}>
                                {' '}
                                (asking {ind.askingOverMaxOffer > 0 ? `${money(ind.askingOverMaxOffer)} above` : `${money(-ind.askingOverMaxOffer)} below`})
                              </span>
                            )}
                          </div>
                          <div>DSCR {ind.dscr === null ? 'UNKNOWN' : ind.dscr.toFixed(2)} · flip {money(ind.flipNetProfit)}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-[12rem] truncate text-xs" title={c.source}>{c.source}</td>
                    <td>
                      {c.status === 'handed_off' && c.dealId ? (
                        <Link href={`/deals/${c.dealId}`} className="text-brand underline">Deal →</Link>
                      ) : (
                        c.status === 'new' ? 'open' : c.status.replace('_', ' ')
                      )}
                    </td>
                    <td className="min-w-[10rem]">
                      {c.status === 'new' && (
                        <div className="space-y-1">
                          <ActionForm action={handOffLead} submitLabel="Send to Deal Analyzer" pendingLabel="Sending…" className="space-y-1" buttonClassName="btn-primary min-h-[36px] w-full whitespace-normal py-1 text-xs">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="version" value={c.version} />
                            {gate.needsReason && <input name="reason" className="input" placeholder="Why, despite the screen? (required)" aria-label={`Reason for ${c.address}`} required />}
                          </ActionForm>
                          <div className="flex gap-1">
                            <form action={rejectLead}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="version" value={c.version} />
                              <button className="btn-secondary min-h-[32px] py-0.5 text-xs">Reject</button>
                            </form>
                            {c.avatarId && (
                              <form action={rescreenLead}>
                                <input type="hidden" name="id" value={c.id} />
                                <button className="btn-secondary min-h-[32px] py-0.5 text-xs">Re-screen</button>
                              </form>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-ink-muted">* indicative total calculated without some line items (see the Deal Analyzer for the full list).</p>
      </section>

      {active.length === 0 ? (
        <section className="card text-sm text-ink-soft">
          No active sourcing target. Open one from a market page (Market Intelligence → a market with KEEP or DRILL DOWN →
          Deal Sourcing), or see <Link href="/sourcing/targets" className="underline">Targets</Link>.
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="card">
            <h2 className="h2">Add a lead</h2>
            <ActionForm action={addLeadAction} submitLabel="Add lead" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-4">
                <label className="label" htmlFor="l-target">Target</label>
                <select id="l-target" name="targetId" className="input" defaultValue={target?.status === 'active' ? target.id : ''} required>
                  <option value="">Choose…</option>
                  {active.map((t) => (
                    <option key={t.id} value={t.id}>{tLabel(t)} ({GEO_LEVEL_LABELS[geo.get(t.geoId)?.level ?? 'msa']})</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="l-addr">Address</label>
                <input id="l-addr" name="address" className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="l-city">City</label>
                <input id="l-city" name="city" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="l-zip">ZIP</label>
                <input id="l-zip" name="zip" className="input" inputMode="numeric" />
              </div>
              <div>
                <label className="label" htmlFor="l-type">Property type</label>
                <select id="l-type" name="propertyType" className="input">
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
                  <label className="label" htmlFor={`l-${k}`}>{l}</label>
                  <input id={`l-${k}`} name={k} className="input" inputMode="decimal" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="label" htmlFor="l-cond">Condition</label>
                <input id="l-cond" name="condition" className="input" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="l-src">Source (required)</label>
                <input id="l-src" name="source" className="input" placeholder="e.g. Agent off-market list" required />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="l-url">Source URL</label>
                <input id="l-url" name="sourceUrl" className="input" placeholder="https://…" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="l-notes">Notes</label>
                <input id="l-notes" name="notes" className="input" />
              </div>
            </ActionForm>
          </section>

          <section className="card">
            <h2 className="h2">Import a list (CSV)</h2>
            <p className="mb-2 text-xs text-ink-muted">
              Up to {MAX_IMPORT_ROWS} rows. Columns (header row, any order; only <code>address</code> is required):{' '}
              <code>{LEAD_COLUMNS.join(', ')}</code>. Blank = UNKNOWN (never 0). Rows already in the pipeline are skipped; invalid
              rows are listed and nothing else is lost.
            </p>
            <ActionForm action={importLeadsAction} submitLabel="Import" pendingLabel="Importing…">
              <select name="targetId" className="input" defaultValue={target?.status === 'active' ? target.id : ''} aria-label="Target for the import" required>
                <option value="">Target…</option>
                {active.map((t) => (
                  <option key={t.id} value={t.id}>{tLabel(t)}</option>
                ))}
              </select>
              <input name="source" className="input" placeholder="List name / source (required)" aria-label="List source" required />
              <input name="file" type="file" accept=".csv,text/csv" className="input" aria-label="CSV file" />
              <textarea name="csv" rows={4} className="input font-mono text-xs" placeholder={'or paste rows:\naddress,zip,property_type,beds,asking_price\n12 Main St,75216,SFR,3,110000'} aria-label="CSV rows" />
            </ActionForm>
          </section>
        </div>
      )}
    </div>
  )
}
