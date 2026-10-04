import Link from 'next/link'
import { applyCompArv } from '@/app/comps-actions'
import { TIER_LABELS, type CompArvResult } from '@/engine/comps'
import type { CompRecord } from '@/lib/comps-repo'
import { money, num, pct } from '@/lib/format'
import { Val } from './Val'

const f2 = (x: number | null) => (x === null ? '—' : x.toFixed(2))

/** Comp-supported Base ARV: the number, how it was built, and the Apply button. */
export function CompArvPanel({
  r,
  baseArv,
  dealId,
  canApply,
  compact = false,
}: {
  r: CompArvResult<CompRecord>
  baseArv: number | null
  dealId: string
  canApply: boolean
  compact?: boolean
}) {
  const diff = r.arv !== null && baseArv !== null && r.arv > 0 ? (baseArv - r.arv) / r.arv : null
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 p-3">
          <div className="text-xs text-ink-muted">Comp-supported ARV</div>
          <div className="text-2xl font-bold tabular-nums"><Val v={money(r.arv)} /></div>
          <div className="text-xs text-ink-muted">
            {r.weightedPpsf === null ? 'No usable renovated comps' : `$${num(r.weightedPpsf, 2)}/sqft weighted × ${r.subjectSqft === null ? 'UNKNOWN' : num(r.subjectSqft)} sqft`}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 p-3">
          <div className="text-xs text-ink-muted">Your Base ARV</div>
          <div className="text-2xl font-bold tabular-nums"><Val v={money(baseArv)} /></div>
          <div className={`text-xs ${diff !== null && diff > 0 ? 'text-amber-800' : 'text-ink-muted'}`}>
            {diff === null ? '—' : diff === 0 ? 'Matches comps' : `${diff > 0 ? '+' : ''}${pct(diff)} vs comps`}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 p-3">
          <div className="text-xs text-ink-muted">Cross-check: median $/sqft (unweighted)</div>
          <div className="text-2xl font-bold tabular-nums"><Val v={money(r.medianPpsfArv)} /></div>
          <div className="text-xs text-ink-muted">{r.used.length} renovated comp(s) used</div>
        </div>
      </div>

      {r.issues.length > 0 && (
        <ul role="alert" className="list-disc space-y-0.5 rounded-md border border-amber-300 bg-amber-50 py-2 pl-7 pr-3 text-xs text-amber-950">
          {r.issues.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      {canApply && r.arv !== null && r.arv !== baseArv && (
        <form action={applyCompArv} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="dealId" value={dealId} />
          <button className="btn-primary">Apply {money(r.arv)} as Base ARV</button>
          <span className="text-xs text-ink-muted">Recorded in the audit trail. Conservative / Upside ARV stay manual.</span>
        </form>
      )}
      {r.subjectSqft === null && (
        <p className="text-xs text-amber-800">
          Subject sqft is UNKNOWN — enter it on the deal (<Link href={`/deals/${dealId}/edit`} className="underline">Edit</Link>) to get a comp ARV.
        </p>
      )}

      {!compact && r.used.length > 0 && (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Comp</th><th>$/sqft</th><th>Tier</th><th>Recency</th><th>Distance</th><th>Similarity</th><th>Weight</th><th>Share</th>
              </tr>
            </thead>
            <tbody>
              {[...r.used].sort((a, b) => b.share - a.share).map((u) => (
                <tr key={u.comp.id}>
                  <td className="min-w-[160px] whitespace-normal font-medium">
                    {u.comp.address}
                    {u.w.unknowns.length > 0 && (
                      <div className="text-xs font-normal text-amber-800">Unknown {u.w.unknowns.join(', ')} → scored as least similar</div>
                    )}
                  </td>
                  <td>${num(u.ppsf, 2)}</td>
                  <td>{TIER_LABELS[u.comp.tier]} ({u.w.tier}×)</td>
                  <td>{f2(u.w.recency)}</td>
                  <td>{f2(u.w.distance)}</td>
                  <td title={`sqft ${f2(u.w.similarityParts.sqft)} · beds ${f2(u.w.similarityParts.beds)} · baths ${f2(u.w.similarityParts.baths)} · status ${f2(u.w.similarityParts.status)}`}>
                    {f2(u.w.similarity)}
                  </td>
                  <td>{f2(u.w.weight)}</td>
                  <td className="font-semibold">
                    {pct(u.share)}
                    {u.overridden && <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-900">fixed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-ink-muted">
            Weight = tier × recency × distance × similarity (each 0.25–1; hover similarity for sqft / beds / baths / status).
            A <em>fixed</em> share is a Super comp % override; the rest is split by weight.
            Weighting numbers are provisional — see <Link href="/methodology" className="underline">Methodology</Link>.
          </p>
        </div>
      )}
      {!compact && r.excluded.length > 0 && (
        <p className="text-xs text-ink-muted">
          Not used for ARV: {r.excluded.map((e) => `${e.comp.address} (${e.reason})`).join('; ')}.
        </p>
      )}
    </div>
  )
}
