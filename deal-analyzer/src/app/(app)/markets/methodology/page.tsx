import { saveMarketConfig } from '@/app/market-actions'
import { ActionForm } from '@/components/ActionForm'
import { getDb } from '@/lib/db'
import { dateTime } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { CONFIGURABLE, DEFAULT_MARKET_CONFIG, getPath, MARKET_ENGINE_VERSION, MARKET_METHODOLOGY } from '@/market/engine/config'
import { FRESHNESS_POLICIES } from '@/market/engine/freshness'
import { METRIC_DEFS } from '@/market/engine/metrics'
import { configRepo } from '@/market/lib/repo'
import { currentConfig } from '@/market/lib/service'

export const dynamic = 'force-dynamic'

const TAG: Record<string, string> = {
  'VF03-SPEC': 'bg-sky-100 text-sky-900',
  PROVISIONAL: 'bg-amber-100 text-amber-900',
  INTERPRETATION: 'bg-slate-100 text-slate-800',
}

export default async function MarketMethodologyPage() {
  const user = await requireUser()
  const db = await getDb()
  const [{ config, overrides, rejected }, history] = await Promise.all([currentConfig(db), configRepo(db).history()])
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Market Intelligence methodology</h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          Every rule VF-03 uses and where it comes from (engine v{MARKET_ENGINE_VERSION}). <strong>VF03-SPEC</strong> = the VF-03
          specification (its weights are “initial”, provisional until validated); <strong>PROVISIONAL</strong> = a placeholder
          awaiting Guy/Ben; <strong>INTERPRETATION</strong> = how a concept is measured with the data available.
        </p>
      </div>
      <section className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Area</th>
              <th>Rule</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {MARKET_METHODOLOGY.map((r) => (
              <tr key={r.area + r.rule} className="align-top">
                <td className="font-medium">{r.area}</td>
                <td className="whitespace-normal">{r.rule}</td>
                <td>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${TAG[r.source]}`}>{r.source}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card max-w-3xl">
        <h2 className="h2">Thresholds (configurable)</h2>
        <p className="mb-2 text-xs text-ink-muted">
          Blank = default. Weights are not editable here: they change only with an approved spec change. {user.role !== 'admin' && 'Only an admin can save changes.'}
          {rejected.length > 0 && ` Ignored invalid stored overrides: ${rejected.join(', ')}.`}
        </p>
        <ActionForm action={saveMarketConfig} submitLabel="Save thresholds" className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CONFIGURABLE.map((c) => (
              <div key={c.path}>
                <label className="label" htmlFor={c.path}>
                  {c.label} <span className="text-ink-muted">(default {getPath(DEFAULT_MARKET_CONFIG, c.path)}, now {getPath(config, c.path)})</span>
                </label>
                <input id={c.path} name={c.path} className="input" inputMode="decimal" defaultValue={overrides[c.path] ?? ''} disabled={user.role !== 'admin'} />
              </div>
            ))}
          </div>
        </ActionForm>
        {history.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {history.map((h, i) => (
              <li key={i}>
                {h.entityId}: {String(h.oldValue ?? 'default')} → {String(h.newValue ?? 'default')} · {h.changedBy} · {dateTime(h.changedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="h2">Freshness policies</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>Policy</th>
              <th>Fresh until</th>
              <th>Stale after</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(FRESHNESS_POLICIES).map(([k, p]) => (
              <tr key={k} className="align-top">
                <td className="font-medium">{p.label}</td>
                <td>{p.freshMonths} months</td>
                <td>{p.staleMonths} months</td>
                <td className="whitespace-normal text-xs">{p.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="h2">Metric catalogue</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>Key</th>
              <th>Metric</th>
              <th>Unit</th>
              <th>Kind</th>
              <th>Freshness</th>
            </tr>
          </thead>
          <tbody>
            {METRIC_DEFS.map((m) => (
              <tr key={m.key}>
                <td className="text-xs"><code>{m.key}</code></td>
                <td>{m.label}</td>
                <td className="text-xs">{m.unit}</td>
                <td className="text-xs">{m.kind}{m.manual ? ' (manual)' : ''}</td>
                <td className="text-xs">{m.freshness}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
