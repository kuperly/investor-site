import Link from 'next/link'
import { setTargetStatus } from '@/app/sourcing-actions'
import { getDb } from '@/lib/db'
import { dateTime } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { GEO_LEVEL_LABELS } from '@/market/engine/types'
import { DecisionBadge } from '@/market/ui/Badges'
import { snapshotsRepo } from '@/market/lib/repo'
import { pipeline } from '@/sourcing/lib/service'

export const dynamic = 'force-dynamic'

export default async function TargetsPage() {
  await requireUser()
  const db = await getDb()
  const [{ targets }, snaps] = await Promise.all([pipeline(db), snapshotsRepo(db).latestTwo()])
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Sourcing targets <span className="text-sm font-normal text-ink-muted">· layer 3</span></h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          A target is <strong>where</strong> we search × <strong>what</strong> we search for (a buy box / avatar). Targets are
          opened from a market page and only where Market Intelligence says KEEP or DRILL DOWN (WATCH needs a written reason; DROP
          or a blocked market never). If the market&apos;s decision later changes, the current decision is shown next to the one
          the target was opened under, so it can be paused or closed.
        </p>
      </div>
      <section className="card overflow-x-auto">
        {targets.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No targets yet. Go to <Link href="/markets" className="underline">Market Intelligence</Link>, open a market with KEEP or DRILL DOWN, and use “Open a
            sourcing target here”.
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Area</th>
                <th>Buy box</th>
                <th>Opened under</th>
                <th>Market now</th>
                <th>Leads (open)</th>
                <th>Status</th>
                <th>Opened</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => {
                const now = snaps.get(t.geoId)?.latest.result.decision.state
                const drift = now && t.gateDecision && now !== t.gateDecision
                return (
                  <tr key={t.id} className={t.status === 'closed' ? 'opacity-60' : ''}>
                    <td className="font-medium">
                      <Link href={`/markets/${encodeURIComponent(t.geoId)}`} className="text-brand underline">{t.geo?.name ?? t.geoId}</Link>
                      <div className="text-xs text-ink-muted">{t.geo ? GEO_LEVEL_LABELS[t.geo.level] : ''}</div>
                    </td>
                    <td>{t.avatarName ?? <span className="text-ink-muted">none (not screened)</span>}</td>
                    <td className="text-xs">
                      {t.gateDecision}
                      {t.overrideReason && <div className="text-ink-muted">“{t.overrideReason}”</div>}
                    </td>
                    <td className={drift ? 'font-semibold text-amber-800' : ''}>
                      {now ? <DecisionBadge state={now} /> : 'UNKNOWN'}
                      {drift && <div className="text-xs">changed since opening</div>}
                    </td>
                    <td>
                      <Link href={`/sourcing/leads?targetId=${t.id}`} className="underline">
                        {t.leads} ({t.open})
                      </Link>
                    </td>
                    <td>{t.status}</td>
                    <td className="text-xs">{dateTime(t.createdAt)} · {t.createdBy}</td>
                    <td className="flex gap-1">
                      {(['active', 'paused', 'closed'] as const)
                        .filter((s) => s !== t.status)
                        .map((s) => (
                          <form key={s} action={setTargetStatus}>
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="version" value={t.version} />
                            <input type="hidden" name="status" value={s} />
                            <button className="btn-secondary min-h-[32px] py-0.5 text-xs">{s === 'active' ? 'Reactivate' : s === 'paused' ? 'Pause' : 'Close'}</button>
                          </form>
                        ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
