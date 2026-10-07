/** Read-only VF-03 panels (server components). Every score shows the raw evidence behind it. */
import type { ChangeExplanation } from '../engine/change'
import type { AvatarFit } from '../engine/avatar'
import type { Evidence } from '../engine/derive'
import type { DimensionResult, MarketEvaluation, MetricScore } from '../engine/evaluate'
import { FRESHNESS_POLICIES, freshness } from '../engine/freshness'
import { METRICS, metricLabel } from '../engine/metrics'
import type { UniverseLine } from '../engine/universe'
import { RiskText } from './Badges'
import { confidenceLabel, FRESHNESS_STYLES, metricValue, score, signed } from './format'

const pct = (x: number) => `${Math.round(x * 100)}%`

function MetricCell({ m }: { m: MetricScore }) {
  return (
    <span className="whitespace-nowrap">
      {m.label}: <strong>{metricValue(m.evidence.value, m.evidence.unit)}</strong>{' '}
      <span className="text-ink-muted">
        → {m.score.toFixed(0)} ({m.method === 'peer_percentile' ? `percentile of ${m.peers}` : 'fixed scale'})
      </span>
    </span>
  )
}

export function DimensionCard({ d }: { d: DimensionResult }) {
  return (
    <section className="card">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{d.label}</h3>
        <div className="text-sm">
          <strong className="text-lg">{score(d.point)}</strong>
          <span className="ml-2 text-xs text-ink-muted">
            range {d.low.toFixed(0)}–{d.high.toFixed(0)} · evidence {pct(d.completeness)} · confidence {d.confidence.toFixed(0)} · freshness{' '}
            {d.freshness === null ? 'UNKNOWN' : d.freshness.toFixed(0)}
          </span>
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Component</th>
            <th>Weight</th>
            <th>Score</th>
            <th>Evidence (raw → 0–100)</th>
          </tr>
        </thead>
        <tbody>
          {d.components.map((c) => (
            <tr key={c.key} className="align-top">
              <td className="font-medium">{c.label}</td>
              <td>{pct(c.weight)}</td>
              <td>{c.score === null ? <span className="unknown">UNKNOWN</span> : c.score.toFixed(0)}</td>
              <td className="whitespace-normal text-xs">
                <div className="space-y-0.5">
                  {c.metrics.map((m) => (
                    <div key={m.metric}>
                      <MetricCell m={m} />
                    </div>
                  ))}
                  {c.missing.map((k) => (
                    <div key={k} className="text-amber-800">
                      {metricLabel(k)}: UNKNOWN (no evidence)
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function RiskPanel({ e }: { e: MarketEvaluation }) {
  const r = e.risk
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Risk level <RiskText level={r.level} /> — score {r.score === null ? 'UNKNOWN' : r.score.toFixed(0)} (unknown factors at best/worst:{' '}
        {r.best.toFixed(0)}–{r.worst.toFixed(0)}), evidence {pct(r.completeness)}. Modifier ×{r.modifier.point.toFixed(2)}
        {r.modifier.low !== r.modifier.high && ` (range ×${r.modifier.low.toFixed(2)}–×${r.modifier.high.toFixed(2)})`}.
        {r.blocked && <strong className="ml-1 text-rose-800">BLOCKED by a critical hard flag.</strong>}
      </p>
      {r.material.length > 0 && <p className="rounded bg-rose-50 p-2 text-sm text-rose-900">Material risk: {r.material.join(', ')}</p>}
      <table className="tbl">
        <thead>
          <tr>
            <th>Factor</th>
            <th>Risk (0 low – 100 high)</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {r.factors.map((f) => (
            <tr key={f.key} className="align-top">
              <td className="font-medium">{f.label}</td>
              <td className={f.material ? 'font-bold text-rose-800' : ''}>{f.score === null ? <span className="unknown">UNKNOWN</span> : f.score.toFixed(0)}</td>
              <td className="whitespace-normal text-xs">
                {f.metrics.map((m) => (
                  <div key={m.metric}>
                    <MetricCell m={m} />
                  </div>
                ))}
                {f.missing.map((k) => (
                  <div key={k} className="text-amber-800">{metricLabel(k)}: UNKNOWN</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StrategyMatrix({ e }: { e: MarketEvaluation }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Strategy</th>
          <th>Fit</th>
          <th>Evidence</th>
          <th>Basis</th>
        </tr>
      </thead>
      <tbody>
        {e.strategies.map((s) => (
          <tr key={s.key} className="align-top">
            <td className="font-medium">
              {s.label}
              {s.overlay && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] uppercase text-ink-muted">overlay</span>}
            </td>
            <td className={s.fit !== null && e.viableStrategies.includes(s.key) ? 'font-bold text-emerald-800' : ''}>
              {s.gateBlocked ? 'Not allowed (0)' : s.fit === null ? <span className="unknown">Insufficient evidence</span> : s.fit.toFixed(0)}
            </td>
            <td>{pct(s.completeness)}</td>
            <td className="whitespace-normal text-xs">
              {s.evidence.map((m) => (
                <div key={m.metric}>
                  <MetricCell m={m} />
                </div>
              ))}
              {s.missing.map((k) => (
                <div key={k} className="text-amber-800">{metricLabel(k)}: UNKNOWN</div>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function UniversePanel({ lines }: { lines: UniverseLine[] }) {
  return (
    <table className="tbl">
      <tbody>
        {lines.map((l) => (
          <tr key={l.key}>
            <td className="font-medium">{l.label}</td>
            <td className="font-semibold">{l.value === null ? <span className="unknown">UNKNOWN</span> : `${l.estimate ? '≈ ' : ''}${Math.round(l.value).toLocaleString('en-US')}`}</td>
            <td className="whitespace-normal text-xs text-ink-muted">
              {l.basis}
              {l.confidence && ` · ${confidenceLabel(l.confidence)}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AvatarFitPanel({ name, fit }: { name: string; fit: AvatarFit }) {
  return (
    <div className="rounded border border-slate-200 p-3 text-sm">
      <div className="font-semibold">{name}</div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {fit.shares.map((s) => (
          <li key={s.label}>
            {s.label}: {s.share === null ? <span className="unknown">UNKNOWN</span> : pct(s.share)} <span className="text-ink-muted">— {s.basis}</span>
          </li>
        ))}
        <li>
          Rent: {fit.rentCheck.medianRent === null ? <span className="unknown">UNKNOWN</span> : metricValue(fit.rentCheck.medianRent, 'usd_month')}
          {fit.rentCheck.rentMin !== null && ` vs minimum ${metricValue(fit.rentCheck.rentMin, 'usd_month')} → ${fit.rentCheck.ok === null ? 'UNKNOWN' : fit.rentCheck.ok ? 'meets it' : 'below it'}`}
        </li>
      </ul>
      <div className="mt-1">
        Matching share: <strong>{fit.matchShare === null ? 'UNKNOWN' : `${(fit.matchShare * 100).toFixed(1)}%`}</strong> · est. matching units:{' '}
        <strong>{fit.estimatedUnits === null ? 'UNKNOWN' : `≈ ${fit.estimatedUnits.toLocaleString('en-US')}`}</strong>
      </div>
      {fit.notes.map((n) => (
        <p key={n} className="text-xs text-ink-muted">{n}</p>
      ))}
    </div>
  )
}

export function ChangePanel({ c }: { c: ChangeExplanation }) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        Priority {c.from === null ? 'UNKNOWN' : c.from.toFixed(1)} → {c.to === null ? 'UNKNOWN' : c.to.toFixed(1)}
        {c.delta !== null && <strong className="ml-1">({signed(c.delta)})</strong>}
        {c.decision && (
          <span className="ml-2">
            Decision {c.decision.from} → <strong>{c.decision.to}</strong>
          </span>
        )}
        {c.significant && <span className="ml-2 rounded bg-sky-100 px-1.5 text-xs text-sky-900">significant</span>}
      </p>
      {c.lines.length > 0 && (
        <ul className="space-y-0.5">
          {c.lines.map((l, i) => (
            <li key={i} className={l.kind === 'component' ? 'pl-4 text-xs text-ink-soft' : ''}>
              {l.label} <strong className={l.delta >= 0 ? 'text-emerald-800' : 'text-rose-800'}>{signed(l.delta)}</strong>
            </li>
          ))}
        </ul>
      )}
      {c.metricChanges.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-ink-muted">Raw values that changed ({c.metricChanges.length})</summary>
          <ul className="mt-1 text-xs">
            {c.metricChanges.map((m) => (
              <li key={m.metric}>
                {m.label}: {metricValue(m.from, m.unit)} → {metricValue(m.to, m.unit)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function EvidenceTable({ evidence, today }: { evidence: Evidence[]; today: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>As of</th>
            <th>Freshness</th>
            <th>Confidence</th>
            <th>Source</th>
            <th>Methodology</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((ev) => {
            const f = freshness(ev.asOf, today, FRESHNESS_POLICIES[METRICS[ev.metric]?.freshness ?? 'manual'])
            return (
              <tr key={ev.metric} className="align-top">
                <td className="font-medium">{metricLabel(ev.metric)}</td>
                <td>{metricValue(ev.value, ev.unit)}</td>
                <td>{ev.asOf}</td>
                <td className={FRESHNESS_STYLES[f.status]}>
                  {f.status} ({f.ageMonths.toFixed(0)} mo)
                </td>
                <td className="text-xs">
                  {confidenceLabel(ev.confidence)}
                  {ev.cv != null && <div className="text-ink-muted">CV {(ev.cv * 100).toFixed(0)}%</div>}
                </td>
                <td className="whitespace-normal text-xs">
                  {ev.sourceUrl ? (
                    <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline">
                      {ev.source}
                    </a>
                  ) : (
                    ev.source
                  )}
                  <div className="text-ink-muted">retrieved {ev.retrievedAt.slice(0, 10)}</div>
                </td>
                <td className="whitespace-normal text-xs text-ink-soft">{ev.methodology}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
