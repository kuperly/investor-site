import Link from 'next/link'
import { deleteComp, toggleCompIncluded } from '@/app/comps-actions'
import { monthsSince, pricePerSqft } from '@/engine/comps'
import type { CompRecord } from '@/lib/comps-repo'
import { money, num } from '@/lib/format'
import { ConfirmButton } from './ConfirmButton'
import { Val } from './Val'

const renoLabel = (r: CompRecord['renovation']) => (r === 'renovated' ? 'Renovated' : r === 'unrenovated' ? 'Unrenovated' : 'Unknown')
const ppsfText = (c: CompRecord) => {
  const v = pricePerSqft(c.salePrice, c.sqft)
  return v === null ? 'UNKNOWN' : `$${num(v)}`
}
const bdba = (c: CompRecord) => `${c.beds ?? '?'} / ${c.baths ?? '?'}`

function Source({ c }: { c: CompRecord }) {
  const label = c.source ?? '—'
  return c.sourceUrl ? (
    <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand underline">{label}</a>
  ) : (
    <span>{label}</span>
  )
}

function Actions({ c, editable }: { c: CompRecord; editable: boolean }) {
  if (!editable) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link href={`/deals/${c.dealId}/comps?edit=${c.id}#comp-form`} className="btn-secondary min-h-[32px] px-2 py-1 text-xs">Edit</Link>
      <form action={toggleCompIncluded}>
        <input type="hidden" name="dealId" value={c.dealId} />
        <input type="hidden" name="compId" value={c.id} />
        <button className="btn-secondary min-h-[32px] px-2 py-1 text-xs">{c.included ? 'Exclude' : 'Include'}</button>
      </form>
      <form action={deleteComp}>
        <input type="hidden" name="dealId" value={c.dealId} />
        <input type="hidden" name="compId" value={c.id} />
        <ConfirmButton message={`Delete comp ${c.address}?`} className="btn min-h-[32px] border border-rose-300 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">
          Delete
        </ConfirmButton>
      </form>
    </div>
  )
}

export function CompsList({ comps, editable = false }: { comps: CompRecord[]; editable?: boolean }) {
  if (comps.length === 0) return <p className="text-sm text-ink-muted">No comps yet.</p>
  const asOf = new Date()
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th>Address</th><th>Sale price</th><th>Sale date</th><th>Sqft</th><th>$/sqft</th><th>Bd / Ba</th>
              <th>Distance</th><th>Condition</th><th>Renovated</th><th>Source</th>{editable && <th />}
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.id} className={c.included ? '' : 'text-ink-muted line-through decoration-slate-400'}>
                <td className="min-w-[160px] max-w-[220px] whitespace-normal font-medium">
                  {c.address}
                  {!c.included && <span className="ml-1 text-xs no-underline">(excluded)</span>}
                  {c.notes && <div className="text-xs font-normal text-ink-muted">{c.notes}</div>}
                </td>
                <td><Val v={money(c.salePrice)} /></td>
                <td>{c.saleDate ? `${c.saleDate} (${num(monthsSince(c.saleDate, asOf), 1)} mo)` : <Val v="UNKNOWN" />}</td>
                <td><Val v={num(c.sqft)} /></td>
                <td><Val v={ppsfText(c)} /></td>
                <td>{bdba(c)}</td>
                <td>{c.distanceMiles === null ? <Val v="UNKNOWN" /> : `${num(c.distanceMiles, 2)} mi`}</td>
                <td className="max-w-[160px] whitespace-normal">{c.condition ?? '—'}</td>
                <td>{renoLabel(c.renovation)}</td>
                <td><Source c={c} /></td>
                {editable && <td><Actions c={c} editable /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {comps.map((c) => (
          <li key={c.id} className={`rounded-md border border-slate-200 p-3 text-sm ${c.included ? '' : 'opacity-60'}`}>
            <div className="flex justify-between gap-2">
              <div className="font-medium">{c.address}{!c.included && ' (excluded)'}</div>
              <div className="font-semibold"><Val v={money(c.salePrice)} /></div>
            </div>
            <div className="mt-1 text-xs text-ink-soft">
              {c.saleDate ?? 'Date unknown'} · {ppsfText(c)}/sqft · {num(c.sqft)} sqft · {bdba(c)} bd/ba ·{' '}
              {c.distanceMiles === null ? '? mi' : `${num(c.distanceMiles, 2)} mi`} · {renoLabel(c.renovation)} · <Source c={c} />
            </div>
            {c.notes && <div className="mt-1 text-xs text-ink-muted">{c.notes}</div>}
            {editable && <div className="mt-2"><Actions c={c} editable /></div>}
          </li>
        ))}
      </ul>
    </>
  )
}
