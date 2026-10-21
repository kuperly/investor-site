import Link from 'next/link'
import { ingestAll } from '@/app/market-actions'
import { getDb } from '@/lib/db'
import { dateTime } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { PROVIDERS } from '@/market/ingest/registry'
import { configured } from '@/market/ingest/types'
import { runsRepo } from '@/market/lib/repo'

export const dynamic = 'force-dynamic'

export default async function IngestionPage() {
  await requireUser()
  const runs = await runsRepo(await getDb()).list({ limit: 50 })
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Data sources</h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          V1 uses official / primary sources only. API keys are set in the deployment environment (never in the app). Every run
          keeps its raw payloads; every value is validated and stored append-only with its source, as-of date, retrieval time and
          confidence. Local evidence (PHA, county records) is entered on a market&apos;s page with its source.
        </p>
      </div>
      <section className="grid gap-3 md:grid-cols-2">
        {PROVIDERS.map((p) => {
          const ok = configured(p, process.env)
          return (
            <div key={p.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold">{p.name}</h2>
                <span className={`rounded px-2 py-0.5 text-xs ${ok ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{ok ? 'Configured' : 'Not configured'}</span>
              </div>
              <p className="text-sm text-ink-soft">{p.description}</p>
              <p className="text-xs text-ink-muted">Levels: {p.levels.join(', ')} · parser {p.version}</p>
              <ul className="text-xs">
                {p.env.map((e) => (
                  <li key={e.name}>
                    <code>{e.name}</code> {e.required ? '(required)' : '(optional)'} — {process.env[e.name] ? 'set' : 'not set'}. {e.help}
                  </li>
                ))}
              </ul>
              <form action={ingestAll}>
                <input type="hidden" name="provider" value={p.id} />
                <button className="btn-secondary" disabled={!ok}>Load for all analyzable geographies</button>
              </form>
              <a href={p.homepage} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">About this source</a>
            </div>
          )
        })}
      </section>
      <section className="card overflow-x-auto">
        <h2 className="h2">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-ink-muted">No runs yet.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>When</th>
                <th>Provider</th>
                <th>Geography</th>
                <th>Status</th>
                <th>Accepted / rejected / duplicate</th>
                <th>By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="align-top">
                  <td>{dateTime(r.startedAt)}</td>
                  <td>{r.provider}</td>
                  <td>{r.geoId ? <Link href={`/markets/${encodeURIComponent(r.geoId)}`} className="underline">{r.geoId}</Link> : '—'}</td>
                  <td>{r.status}</td>
                  <td>{r.accepted} / {r.rejected} / {r.duplicates}</td>
                  <td>{r.requestedBy}</td>
                  <td className="max-w-lg whitespace-normal text-xs text-ink-muted">{r.errors.slice(0, 4).join(' · ')}{r.errors.length > 4 && ` (+${r.errors.length - 4})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
