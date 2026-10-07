'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { compArv } from '@/engine/comps'
import { syncCompSummary } from '@/lib/comp-summary'
import { compsRepo } from '@/lib/comps-repo'
import { parseComp, type CompErrors } from '@/lib/comps/parse-comp'
import { getDb } from '@/lib/db'
import { dealsRepo } from '@/lib/deals-repo'
import { snapshotDeal } from '@/lib/deal-snapshots'
import { currentActor } from '@/lib/session'
import type { Db } from '@/lib/db'

export interface CompSaveState {
  error?: string
  errors?: CompErrors
}

const NO_USER = 'Your session has ended — sign in again.'

/** Runs a comp change, the §8 summary sync and the analysis snapshot in one transaction. */
async function inTx<T>(fn: (r: { db: Db; comps: ReturnType<typeof compsRepo>; deals: ReturnType<typeof dealsRepo> }) => Promise<T>) {
  return (await getDb()).transaction((tx) => fn({ db: tx, comps: compsRepo(tx), deals: dealsRepo(tx) }))
}

async function afterCompChange(db: Db, dealId: string, user: string) {
  await syncCompSummary(db, dealId, user)
  await snapshotDeal(db, dealId, user)
}

function refresh(dealId: string) {
  revalidatePath('/')
  revalidatePath(`/deals/${dealId}`)
  revalidatePath(`/deals/${dealId}/comps`)
}

export async function saveComp(_prev: CompSaveState, formData: FormData): Promise<CompSaveState> {
  const user = await currentActor()
  if (!user) return { error: NO_USER }
  const dealId = String(formData.get('dealId') ?? '')
  const compId = String(formData.get('compId') ?? '')
  const { comp, errors } = parseComp((k) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : null
  })
  if (Object.keys(errors).length > 0) return { error: 'Please fix the highlighted fields.', errors }

  const error = await inTx(async ({ db, comps, deals }) => {
    if (!(await deals.get(dealId))) return 'Deal not found.'
    if (compId) {
      if (!(await comps.update(dealId, compId, comp, user))) return 'Comp not found.'
    } else {
      await comps.add(dealId, comp, user)
    }
    await afterCompChange(db, dealId, user)
    return null
  })
  if (error) return { error }
  refresh(dealId)
  redirect(`/deals/${dealId}/comps`)
}

export async function deleteComp(formData: FormData) {
  const user = await currentActor()
  const dealId = String(formData.get('dealId') ?? '')
  if (!user) return
  await inTx(async ({ db, comps }) => {
    if (await comps.remove(dealId, String(formData.get('compId') ?? ''), user)) await afterCompChange(db, dealId, user)
  })
  refresh(dealId)
}

export async function toggleCompIncluded(formData: FormData) {
  const user = await currentActor()
  const dealId = String(formData.get('dealId') ?? '')
  if (!user) return
  await inTx(async ({ db, comps }) => {
    const c = await comps.get(dealId, String(formData.get('compId') ?? ''))
    if (!c) return
    await comps.update(dealId, c.id, { ...c, included: !c.included }, user)
    await afterCompChange(db, dealId, user)
  })
  refresh(dealId)
}

/** Sets Base ARV to the comp-supported ARV (approved flow: suggest → user clicks Apply; audited). */
export async function applyCompArv(formData: FormData) {
  const user = await currentActor()
  const dealId = String(formData.get('dealId') ?? '')
  if (!user) return
  await inTx(async ({ db, comps, deals }) => {
    const deal = await deals.get(dealId)
    if (!deal) return
    const i = deal.inputs
    const r = compArv(await comps.list(dealId), { sqft: i.sqft, beds: i.beds, baths: i.baths }, new Date())
    if (r.arv === null) return
    if ((await deals.update(dealId, { inputs: { ...i, arvBase: r.arv } }, user)) > 0) await snapshotDeal(db, dealId, user)
  })
  refresh(dealId)
}
