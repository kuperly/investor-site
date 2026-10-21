import Link from 'next/link'
import { saveAvatar } from '@/app/market-actions'
import { ActionForm } from '@/components/ActionForm'
import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { AVATAR_PROPERTY_TYPES, type Avatar } from '@/market/engine/avatar'
import { STRATEGIES, STRATEGY_KEYS } from '@/market/engine/config'
import { avatarsRepo } from '@/market/lib/repo'

export const dynamic = 'force-dynamic'

const RANGES: [string, keyof Avatar, keyof Avatar, string][] = [
  ['Bedrooms', 'bedsMin', 'bedsMax', ''],
  ['Year built', 'yearBuiltMin', 'yearBuiltMax', ''],
  ['Square feet', 'sqftMin', 'sqftMax', ''],
  ['Purchase price', 'purchaseMin', 'purchaseMax', '$'],
  ['ARV', 'arvMin', 'arvMax', '$'],
  ['Value-add (rehab)', 'rehabMin', 'rehabMax', '$'],
]
const n = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const range = (a: Avatar, lo: keyof Avatar, hi: keyof Avatar, unit: string) => {
  const f = (v: unknown) => (v === null ? '…' : `${unit}${Number(v).toLocaleString('en-US')}`)
  return a[lo] === null && a[hi] === null ? '—' : `${f(a[lo])}–${f(a[hi])}`
}

export default async function AvatarsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireUser()
  const { edit } = await searchParams
  const repo = avatarsRepo(await getDb())
  const avatars = await repo.list()
  const editing = edit ? avatars.find((a) => a.id === edit) : undefined
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Avatars</h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          The property universe ValeForge wants to pursue. Markets and ZIPs are measured against each active avatar (share of the
          housing stock that matches, estimated matching units). There is no built-in avatar: Guy and Ben define them.
        </p>
      </div>
      <section className="card overflow-x-auto">
        {avatars.length === 0 ? (
          <p className="text-sm text-ink-muted">No avatars yet.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Types</th>
                {RANGES.map(([l]) => (
                  <th key={l}>{l}</th>
                ))}
                <th>Rent ≥</th>
                <th>Strategies</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {avatars.map((a) => (
                <tr key={a.id} className={a.active ? '' : 'opacity-60'}>
                  <td className="font-medium">{a.name}{!a.active && ' (inactive)'}</td>
                  <td className="text-xs">{a.propertyTypes.map((t) => AVATAR_PROPERTY_TYPES[t].label).join(', ')}</td>
                  {RANGES.map(([l, lo, hi, u]) => (
                    <td key={l}>{range(a, lo, hi, u)}</td>
                  ))}
                  <td>{a.rentMin === null ? '—' : `$${a.rentMin.toLocaleString('en-US')}`}</td>
                  <td className="text-xs">{a.strategies.map((s) => STRATEGIES[s].label).join(', ')}</td>
                  <td>
                    <Link href={`/markets/avatars?edit=${a.id}`} className="text-brand underline">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card max-w-3xl">
        <h2 className="h2">{editing ? `Edit “${editing.name}”` : 'New avatar'}</h2>
        <ActionForm key={editing?.id ?? 'new'} action={saveAvatar} submitLabel={editing ? 'Save avatar' : 'Create avatar'}>
          {editing && (
            <>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="version" value={editing.version} />
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="av-name">Name</label>
              <input id="av-name" name="name" className="input" defaultValue={editing?.name} required />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Active
            </label>
            <div className="col-span-2">
              <label className="label" htmlFor="av-desc">Description</label>
              <input id="av-desc" name="description" className="input" defaultValue={editing?.description} />
            </div>
          </div>
          <fieldset>
            <legend className="label">Property types</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.entries(AVATAR_PROPERTY_TYPES).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1">
                  <input type="checkbox" name="propertyTypes" value={k} defaultChecked={editing?.propertyTypes.includes(k as never)} /> {v.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {RANGES.map(([l, lo, hi]) => (
              <div key={l} className="flex gap-1">
                <div>
                  <label className="label" htmlFor={`av-${lo}`}>{l} min</label>
                  <input id={`av-${lo}`} name={lo} className="input" inputMode="decimal" defaultValue={n(editing?.[lo])} />
                </div>
                <div>
                  <label className="label" htmlFor={`av-${hi}`}>max</label>
                  <input id={`av-${hi}`} name={hi} className="input" inputMode="decimal" defaultValue={n(editing?.[hi])} />
                </div>
              </div>
            ))}
            <div>
              <label className="label" htmlFor="av-rent">Minimum rent ($/month)</label>
              <input id="av-rent" name="rentMin" className="input" inputMode="decimal" defaultValue={n(editing?.rentMin)} />
            </div>
          </div>
          <fieldset>
            <legend className="label">Target strategies</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {STRATEGY_KEYS.map((s) => (
                <label key={s} className="flex items-center gap-1">
                  <input type="checkbox" name="strategies" value={s} defaultChecked={editing?.strategies.includes(s)} /> {STRATEGIES[s].label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-ink-muted">Blank = no limit. Example only (not a default): 3 BR single-family, built 1940–1980, 1,100–1,700 sqft, purchase $80K–$150K, ARV $160K–$240K, rent $1,400+, rehab $25K–$60K.</p>
        </ActionForm>
      </section>
    </div>
  )
}
