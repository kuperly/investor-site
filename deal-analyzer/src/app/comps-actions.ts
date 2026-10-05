'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { compArv } from '@/engine/comps'
import { syncCompSummary } from '@/lib/comp-summary'
import { compsRepo } from '@/lib/comps-repo'
import { parseComp, type CompErrors } from '@/lib/comps/parse-comp'
import { getDb } from '@/lib/db'
import { dealsRepo } from '@/lib/deals-repo'
import { currentUser } from '@/lib/session'

export interface CompSaveState {
  error?: string
  errors?: CompErrors
}

const NO_USER = 'Choose who you are (Guy or Ben) in the header first — comp changes are recorded in the audit trail.'

async function repos() {
  const db = await getDb()
  return { comps: compsRepo(db), deals: dealsRepo(db) }
}

async function afterCompChange(dealId: string, user: Parameters<typeof syncCompSummary>[2]) {
  await syncCompSummary(await getDb(), dealId, user)
  refresh(dealId)
}

function refresh(dealId: string) {
  revalidatePath('/')
  revalidatePath(`/deals/${dealId}`)
  revalidatePath(`/deals/${dealId}/comps`)
}

export async function saveComp(_prev: CompSaveState, formData: FormData): Promise<CompSaveState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const dealId = String(formData.get('dealId') ?? '')
  const compId = String(formData.get('compId') ?? '')
  const { comp, errors } = parseComp((k) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : null
  })
  if (Object.keys(errors).length > 0) return { error: 'Please fix the highlighted fields.', errors }

  const { comps, deals } = await repos()
  if (!(await deals.get(dealId))) return { error: 'Deal not found.' }
  if (compId) {
    if (!(await comps.update(dealId, compId, comp, user))) return { error: 'Comp not found.' }
  } else {
    await comps.add(dealId, comp, user)
  }
  await afterCompChange(dealId, user)
  redirect(`/deals/${dealId}/comps`)
}

export async function deleteComp(formData: FormData) {
  const user = await currentUser()
  const dealId = String(formData.get('dealId') ?? '')
  if (!user) return
  await (await repos()).comps.remove(dealId, String(formData.get('compId') ?? ''), user)
  await afterCompChange(dealId, user)
}

export async function toggleCompIncluded(formData: FormData) {
  const user = await currentUser()
  const dealId = String(formData.get('dealId') ?? '')
  if (!user) return
  const { comps } = await repos()
  const c = await comps.get(dealId, String(formData.get('compId') ?? ''))
  if (!c) return
  await comps.update(dealId, c.id, { ...c, included: !c.included }, user)
  await afterCompChange(dealId, user)
}

/** Sets Base ARV to the comp-supported ARV (approved flow: suggest → user clicks Apply; audited). */
export async function applyCompArv(formData: FormData) {
  const user = await currentUser()
  const dealId = String(formData.get('dealId') ?? '')
  if (!user) return
  const { comps, deals } = await repos()
  const deal = await deals.get(dealId)
  if (!deal) return
  const i = deal.inputs
  const r = compArv(await comps.list(dealId), { sqft: i.sqft, beds: i.beds, baths: i.baths }, new Date())
  if (r.arv === null) return
  await deals.update(dealId, { inputs: { ...i, arvBase: r.arv } }, user)
  refresh(dealId)
}
