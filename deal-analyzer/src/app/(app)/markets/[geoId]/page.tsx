import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  addFlag,
  addGeography,
  addManualObservation,
  addSample,
  evaluateNow,
  ingest,
  promoteGeo,
  resolveFlag,
  retireSample,
  revokePromotion,
} from '@/app/market-actions'
import { ActionForm } from '@/components/ActionForm'
import { getDb } from '@/lib/db'
import { dealsRepo } from '@/lib/deals-repo'
import { dateTime } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { avatarFit } from '@/market/engine/avatar'
import { explainChange } from '@/market/engine/change'
import { DIMENSION_WEIGHTS, type DimensionKey } from '@/market/engine/config'
import { deriveEvidence } from '@/market/engine/derive'
import { MANUAL_METRICS } from '@/market/engine/metrics'
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, GEO_LEVEL_LABELS, PARENT_LEVELS, type GeoLevel } from '@/market/engine/types'
import { opportunityUniverse } from '@/market/engine/universe'
import { PROVIDERS } from '@/market/ingest/registry'
import { configured } from '@/market/ingest/types'
import { avatarsRepo, flagsRepo, geoRepo, observationsRepo, promotionsRepo, runsRepo, samplesRepo, snapshotsRepo } from '@/market/lib/repo'
import { canAddChild, currentConfig } from '@/market/lib/service'
import { DecisionBadge, RiskText, Sparkline } from '@/market/ui/Badges'
import { openTargetAction } from '@/app/sourcing-actions'
import { targetGate } from '@/sourcing/engine/gates'
import { candidatesRepo, targetsRepo } from '@/sourcing/lib/repo'
import type { Db } from '@/lib/db'
import { AvatarFitPanel, ChangePanel, DimensionCard, EvidenceTable, RiskPanel, StrategyMatrix, UniversePanel } from '@/market/ui/Panels'
import { metricValue, priorityText } from '@/market/ui/format'

export const dynamic = 'force-dynamic'

const DIMS = Object.keys(DIMENSION_WEIGHTS) as DimensionKey[]

export default async function MarketPage({ params }: { params: Promise<{ geoId: string }> }) {
  await requireUser()
  const geoId = decodeURIComponent((await params).geoId)
  const db = await getDb()
  const geos = geoRepo(db)
  const geo = await geos.get(geoId)
  if (!geo) notFound()
  const [ancestors, children, history, flags, samples, avatars, promotions, runs, observations, rejected, sourcing, deals, { config }] = await Promise.all([
    geos.ancestors(geoId),
    geos.list({ parentId: geoId }),
    snapshotsRepo(db).history(geoId),
    flagsRepo(db).active([geoId]),
    samplesRepo(db).active([geoId]),
    avatarsRepo(db).list({ activeOnly: true }),
    promotionsRepo(db).active(),
    runsRepo(db).list({ geoId, limit: 10 }),
    observationsRepo(db).forGeo(geoId),
    observationsRepo(db).forGeo(geoId, { includeRejected: true }).then((o) => o.filter((x) => x.validationStatus === 'rejected')),
    pipelineForGeo(db, geoId),
    dealsRepo(db).list(),
    currentConfig(db),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const latest = history[0] ?? null
  const e = latest?.result ?? null
  const change = history[1] && latest ? explainChange(history[1].result, latest.result, config) : null
  const evidence = e?.evidence ?? deriveEvidence(observations)
  const promotion = promotions.get(geoId)
  const childLevels = (Object.keys(PARENT_LEVELS) as GeoLevel[]).filter((l) => PARENT_LEVELS[l].includes(geo.level))
  const mayAddChildren = childLevels.length > 0 && (await canAddChild(db, geoId))
  const dealTitle = new Map(deals.map((d) => [d.id, d.inputs.address ?? d.id]))

  return (
    <div className="space-y-4">
      <nav className="text-xs text-ink-muted" aria-label="Breadcrumb">
        <Link href="/markets" className="underline">Markets</Link>
        {ancestors.map((a) => (
          <span key={a.id}>
            {' / '}
            <Link href={`/markets/${encodeURIComponent(a.id)}`} className="underline">{a.name}</Link>
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{geo.name}</h1>
          <p className="text-sm text-ink-soft">
            {GEO_LEVEL_LABELS[geo.level]} · key <code>{geo.id}</code>
            {geo.state && ` · ${geo.state}`}
          </p>
        </div>
        <form action={evaluateNow}>
          <button className="btn-primary">Evaluate now</button>
        </form>
      </div>

      {!e ? (
        <section className="card text-sm text-ink-soft">
          Not evaluated yet. Load data (below), then <strong>Evaluate now</strong>. Scores are relative to peer markets, so
          evaluate after several markets have data.
        </section>
      ) : (
        <>
          <section className="card">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <div className="text-xs uppercase text-ink-muted">Decision</div>
                <DecisionBadge state={e.decision.state} />
              </div>
              <div>
                <div className="text-xs uppercase text-ink-muted">Core score</div>
                <div className="text-2xl font-bold">{priorityText(e.priority)}</div>
                <div className="text-xs text-ink-muted">
                  {e.priority.display === 'range' ? 'range: evidence too thin for a precise score' : e.priority.rank ? `rank #${e.priority.rank} of ${e.peerGroup.size}` : ''}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-ink-muted">Risk</div>
                <RiskText level={e.risk.level} /> <span className="text-xs">×{e.risk.modifier.point.toFixed(2)}</span>
              </div>
              <div>
                <div className="text-xs uppercase text-ink-muted">Confidence</div>
                {e.confidence.label} ({e.confidence.score.toFixed(0)})
              </div>
              <div>
                <div className="text-xs uppercase text-ink-muted">Freshness</div>
                {e.freshness.score === null ? 'UNKNOWN' : e.freshness.score.toFixed(0)}
                {e.freshness.stale.length > 0 && <span className="ml-1 text-xs text-rose-800">{e.freshness.stale.length} stale</span>}
              </div>
              <div>
                <div className="text-xs uppercase text-ink-muted">Trend</div>
                <Sparkline values={[...history].reverse().map((h) => h.priority)} />
              </div>
              <div className="text-xs text-ink-muted">
                Evaluated {dateTime(latest!.createdAt)} by {latest!.createdBy}
                <br />
                engine v{e.engineVersion} · peers: {e.peerGroup.size}
              </div>
            </div>
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm">
              {e.decision.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-muted">
              Score = (Quality {e.dimensions.marketQuality.point ?? '?'} × 25% + Opportunity {e.dimensions.opportunityDensity.point ?? '?'} × 30% +
              Capital {e.dimensions.capitalEfficiency.point ?? '?'} × 25% + Strategy {e.dimensions.strategyFit.point ?? '?'} × 20%, over the known
              dimensions) × risk modifier. Evidence coverage {Math.round(e.priority.completeness * 100)}%; bounds {e.priority.low.toFixed(0)}–{e.priority.high.toFixed(0)}.
            </p>
          </section>

          {change && (
            <section className="card">
              <h2 className="h2">Why it changed (vs the previous evaluation)</h2>
              <ChangePanel c={change} />
            </section>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {DIMS.map((d) => (
              <DimensionCard key={d} d={e.dimensions[d]} />
            ))}
          </div>

          <section className="card">
            <h2 className="h2">Strategy matrix</h2>
            <p className="mb-2 text-xs text-ink-muted">
              Each strategy scored on its own evidence. Viable (fit ≥ {config.strategyFit.viableFit}): {e.viableStrategies.length ? e.viableStrategies.join(', ') : 'none yet'}.
            </p>
            <StrategyMatrix e={e} />
          </section>

          <section className="card">
            <h2 className="h2">Risk</h2>
            <RiskPanel e={e} />
          </section>
        </>
      )}

      <section className="card">
        <h2 className="h2">Hard risk flags</h2>
        {flags.length === 0 ? (
          <p className="text-sm text-ink-muted">None. A critical flag blocks this geography regardless of its score.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {flags.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <strong className={f.severity === 'critical' ? 'text-rose-800' : 'text-amber-800'}>{f.severity.toUpperCase()}</strong> {f.category}: {f.reason}
                <span className="text-xs text-ink-muted">({f.source})</span>
                <form action={resolveFlag}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="geoId" value={geoId} />
                  <button className="text-xs underline">Resolve</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-brand">Add a hard risk flag</summary>
          <ActionForm action={addFlag} submitLabel="Add flag" className="mt-2 grid max-w-2xl grid-cols-2 gap-2">
            <input type="hidden" name="geoId" value={geoId} />
            <select name="severity" className="input" aria-label="Severity" defaultValue="high">
              <option value="high">High (forces the High risk modifier)</option>
              <option value="critical">Critical (blocks the market)</option>
            </select>
            <input name="category" className="input" placeholder="Category (e.g. Regulatory)" aria-label="Category" required />
            <input name="reason" className="input col-span-2" placeholder="What is the risk?" aria-label="Reason" required />
            <input name="source" className="input" placeholder="Source" aria-label="Source" required />
            <input name="sourceUrl" className="input" placeholder="https://…" aria-label="Source URL" />
          </ActionForm>
        </details>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card">
          <h2 className="h2">Opportunity universe</h2>
          <UniversePanel lines={opportunityUniverse(evidence, avatars)} />
        </section>
        <section className="card">
          <h2 className="h2">Avatar fit</h2>
          {avatars.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No active avatars. <Link href="/markets/avatars" className="underline">Define one</Link> to estimate the matching property universe.
            </p>
          ) : (
            <div className="space-y-2">
              {avatars.map((a) => (
                <AvatarFitPanel key={a.id} name={a.name} fit={avatarFit(a, evidence)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="h2">Drill-down</h2>
        {promotion ? (
          <div className="space-y-1 text-sm">
            <p>
              <strong>Promoted</strong> by {promotion.promotedBy} on {dateTime(promotion.promotedAt)} (priority {promotion.reason.priority ?? 'UNKNOWN'}, decision {promotion.reason.decision}).
            </p>
            <ul className="list-disc pl-5 text-xs">
              {promotion.reason.checks.map((c) => (
                <li key={c.label}>
                  {c.label}: {c.detail}
                </li>
              ))}
            </ul>
            <form action={revokePromotion}>
              <input type="hidden" name="geoId" value={geoId} />
              <button className="text-xs underline">Revoke promotion (children stop being analyzed)</button>
            </form>
          </div>
        ) : e?.drillDown.state === 'not_applicable' || !e ? (
          <p className="text-sm text-ink-muted">{e ? 'This level is not drilled further in V1 (ZIP is the operational level).' : 'Evaluate first.'}</p>
        ) : (
          <div className="space-y-2 text-sm">
            <ul className="space-y-0.5">
              {e.drillDown.checks.map((c) => (
                <li key={c.label}>
                  {c.pass === true ? '✓' : c.pass === false ? '✗' : '?'} {c.label} <span className="text-ink-muted">({c.detail})</span>
                </li>
              ))}
            </ul>
            <ActionForm action={promoteGeo} submitLabel="Promote for drill-down" buttonClassName={e.drillDown.state === 'eligible' ? 'btn-primary' : 'btn-secondary'}>
              <input type="hidden" name="geoId" value={geoId} />
            </ActionForm>
          </div>
        )}
        {children.length > 0 && (
          <div className="mt-3">
            <h3 className="text-sm font-semibold">Children</h3>
            <ul className="text-sm">
              {children.map((c) => (
                <li key={c.id}>
                  <Link href={`/markets/${encodeURIComponent(c.id)}`} className="text-brand underline">{c.name}</Link>{' '}
                  <span className="text-xs text-ink-muted">{GEO_LEVEL_LABELS[c.level]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {mayAddChildren && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-brand">Add a {childLevels.map((l) => GEO_LEVEL_LABELS[l]).join(' / ')}</summary>
            <ActionForm action={addGeography} submitLabel="Add" className="mt-2 grid max-w-2xl grid-cols-2 gap-2">
              <input type="hidden" name="parentId" value={geoId} />
              <select name="level" className="input" aria-label="Level">
                {childLevels.map((l) => (
                  <option key={l} value={l}>{GEO_LEVEL_LABELS[l]}</option>
                ))}
              </select>
              <input name="code" className="input" placeholder="Official code (ZCTA / GEOID); blank for a submarket" aria-label="Code" />
              <input name="name" className="input col-span-2" placeholder="Name (neighborhood names are display only)" aria-label="Name" />
            </ActionForm>
          </details>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Deal Sourcing (layer 3 → 4)</h2>
        {(() => {
          const gate = targetGate(e ? { decision: e.decision.state, blocked: e.priority.blocked } : null)
          return (
            <div className="space-y-2 text-sm">
              <p>
                <strong>{gate.allowed ? (gate.needsReason ? 'Sourcing allowed with a reason' : 'Sourcing allowed') : 'Sourcing closed'}</strong> — {gate.message}
              </p>
              {sourcing.targets.length > 0 && (
                <ul className="space-y-0.5">
                  {sourcing.targets.map((t) => (
                    <li key={t.id}>
                      <Link href={`/sourcing/leads?targetId=${t.id}`} className="text-brand underline">
                        Target: {avatars.find((a) => a.id === t.avatarId)?.name ?? 'no buy box'}
                      </Link>{' '}
                      <span className="text-xs text-ink-muted">
                        {t.status} · {t.leads} lead{t.leads === 1 ? '' : 's'} ({t.open} open) · opened under {t.gateDecision}
                        {t.overrideReason && ` — reason: ${t.overrideReason}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {gate.allowed && (
                <details>
                  <summary className="cursor-pointer text-brand">Open a sourcing target here</summary>
                  <ActionForm action={openTargetAction} submitLabel="Open target" className="mt-2 grid max-w-2xl grid-cols-2 gap-2">
                    <input type="hidden" name="geoId" value={geoId} />
                    <select name="avatarId" className="input" aria-label="Buy box (avatar)">
                      <option value="">No buy box (leads are not screened)</option>
                      {avatars.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <input name="notes" className="input" placeholder="Notes (optional)" aria-label="Notes" />
                    {gate.needsReason && <input name="reason" className="input col-span-2" placeholder="Why search here while the market is WATCH? (required)" aria-label="Reason" required />}
                  </ActionForm>
                </details>
              )}
            </div>
          )
        })()}
      </section>

      <section className="card">
        <h2 className="h2">Capital-efficiency samples (underwritten by the Deal Analyzer)</h2>
        <p className="mb-2 text-xs text-ink-muted">
          Link a Deal Analyzer deal (live) or freeze a copy of its inputs as a market assumption set. VF-03 never re-computes
          underwriting: it reads the Deal Analyzer&apos;s own results and takes the median across samples.
        </p>
        {samples.length > 0 && (
          <ul className="mb-2 space-y-1 text-sm">
            {samples.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <strong>{s.label}</strong>
                <span className="text-xs text-ink-muted">
                  {s.kind === 'deal' ? `live link to ${dealTitle.get(s.dealId ?? '') ?? 'a deal'}` : 'frozen assumption set'} · {CONFIDENCE_LABELS[s.confidence]} · {s.source} · as of {s.asOf}
                </span>
                <form action={retireSample}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="geoId" value={geoId} />
                  <button className="text-xs underline">Retire</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-brand">Add a sample</summary>
          <ActionForm action={addSample} submitLabel="Add sample" className="mt-2 grid max-w-2xl grid-cols-2 gap-2">
            <input type="hidden" name="geoId" value={geoId} />
            <select name="dealId" className="input col-span-2" aria-label="Deal" required>
              <option value="">Choose a deal…</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>{d.inputs.address}</option>
              ))}
            </select>
            <select name="mode" className="input" aria-label="Mode">
              <option value="deal">Live link (follows the deal)</option>
              <option value="copy">Frozen copy (assumption set)</option>
            </select>
            <input name="label" className="input" placeholder="Label (e.g. Typical 3/1 in 75216)" aria-label="Label" />
            <input name="source" className="input" placeholder="Where the numbers come from" aria-label="Source" required />
            <select name="confidence" className="input" aria-label="Evidence strength" defaultValue="single_secondary">
              {CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>{CONFIDENCE_LABELS[c]}</option>
              ))}
            </select>
            <input name="asOf" type="date" className="input" aria-label="As of" />
            <input name="sourceUrl" className="input" placeholder="https://… (optional)" aria-label="Source URL" />
          </ActionForm>
        </details>
      </section>

      <section className="card">
        <h2 className="h2">Data</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {PROVIDERS.filter((p) => p.levels.includes(geo.level)).map((p) => (
            <form key={p.id} action={ingest}>
              <input type="hidden" name="provider" value={p.id} />
              <input type="hidden" name="geoId" value={geoId} />
              <button className="btn-secondary" disabled={!configured(p, process.env)} title={configured(p, process.env) ? p.description : `Set ${p.env.filter((x) => x.required).map((x) => x.name).join(', ')}`}>
                Load {p.name.split('—')[0].trim()}
                {!configured(p, process.env) && ' (not configured)'}
              </button>
            </form>
          ))}
        </div>
        {runs.length > 0 && (
          <table className="tbl mb-3">
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Accepted / rejected / duplicate</th>
                <th>By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="text-xs">{r.provider} · {dateTime(r.startedAt)}</td>
                  <td>{r.status}</td>
                  <td>{r.accepted} / {r.rejected} / {r.duplicates}</td>
                  <td>{r.requestedBy}</td>
                  <td className="max-w-md whitespace-normal text-xs text-ink-muted">{r.errors.slice(0, 3).join(' · ')}{r.errors.length > 3 && ` (+${r.errors.length - 3})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-brand">Enter evidence by hand (local records, PHA, field research)</summary>
          <ActionForm action={addManualObservation} submitLabel="Record" className="mt-2 grid max-w-3xl grid-cols-2 gap-2">
            <input type="hidden" name="geoId" value={geoId} />
            <select name="metric" className="input col-span-2" aria-label="Metric" required>
              <option value="">Choose a metric…</option>
              {MANUAL_METRICS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}{m.unit === 'ratio' ? ' (enter as %)' : ''}</option>
              ))}
            </select>
            <input name="value" className="input" placeholder="Value" aria-label="Value" required />
            <input name="asOf" type="date" className="input" aria-label="As of" required />
            <input name="source" className="input" placeholder="Source (required)" aria-label="Source" required />
            <input name="sourceUrl" className="input" placeholder="https://…" aria-label="Source URL" />
            <select name="confidence" className="input" aria-label="Evidence strength" defaultValue="single_secondary">
              {CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>{CONFIDENCE_LABELS[c]}</option>
              ))}
            </select>
            <input name="methodology" className="input" placeholder="How it was measured (optional)" aria-label="Methodology" />
          </ActionForm>
        </details>
      </section>

      <section className="card">
        <h2 className="h2">Raw evidence and provenance ({Object.keys(evidence).length})</h2>
        <EvidenceTable evidence={Object.values(evidence).sort((a, b) => a.metric.localeCompare(b.metric))} today={today} />
        {rejected.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-ink-muted">Rejected values ({rejected.length}) — kept, never scored</summary>
            <ul className="mt-1 text-xs">
              {rejected.map((r) => (
                <li key={r.id}>
                  {r.metric} {r.asOf}: {Number.isNaN(r.value) ? '—' : metricValue(r.value, r.unit)} — {r.validationErrors.join('; ')}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {history.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="h2">History</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Evaluated</th>
                <th>By</th>
                <th>Core score</th>
                {DIMS.map((d) => (
                  <th key={d}>{d.replace(/([A-Z])/g, ' $1').toLowerCase()}</th>
                ))}
                <th>Risk</th>
                <th>Confidence</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{dateTime(h.createdAt)}</td>
                  <td>{h.createdBy}</td>
                  <td>{priorityText(h.result.priority)}</td>
                  {DIMS.map((d) => (
                    <td key={d}>{h.result.dimensions[d].point ?? 'UNKNOWN'}</td>
                  ))}
                  <td>{h.result.risk.level ?? 'UNKNOWN'}</td>
                  <td>{h.result.confidence.score.toFixed(0)}</td>
                  <td>
                    <DecisionBadge state={h.result.decision.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

/** Targets in this geography with their lead counts (Deal Sourcing, layer 3). */
async function pipelineForGeo(db: Db, geoId: string) {
  const [targets, leads] = await Promise.all([targetsRepo(db).list({ geoId }), candidatesRepo(db).list({ geoId })])
  return {
    targets: targets.map((t) => ({
      ...t,
      leads: leads.filter((l) => l.targetId === t.id).length,
      open: leads.filter((l) => l.targetId === t.id && l.status === 'new').length,
    })),
  }
}
