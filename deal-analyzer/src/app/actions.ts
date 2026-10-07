'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DEAL_STATUSES, type DealStatus } from '@/engine/types'
import { NOTE_CATEGORIES, type DealNotes } from '@/lib/notes'
import { parseDealForm, type FieldErrors } from '@/lib/parse-inputs'
import { getDb } from '@/lib/db'
import { compSummaryFor } from '@/lib/comp-summary'
import { DealConflictError, dealsRepo } from '@/lib/deals-repo'
import { snapshotDeal } from '@/lib/deal-snapshots'
import { isDefaultable, type DefaultableKey } from '@/engine/fields'
import { currentActor } from '@/lib/session'

export interface SaveState {
  error?: string
  errors?: FieldErrors
}

function readStatus(v: FormDataEntryValue | null): DealStatus {
  return (DEAL_STATUSES as readonly string[]).includes(String(v)) ? (v as DealStatus) : 'Lead'
}

export async function saveDeal(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await currentActor()
  if (!user) return { error: 'Your session has ended — sign in again to save.' }

  const parsed = parseDealForm((k) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : null
  })
  const { errors } = parsed
  if (Object.keys(errors).length > 0) return { error: 'Please fix the highlighted fields.', errors }

  const notes: DealNotes = {}
  for (const { key } of NOTE_CATEGORIES) {
    const v = String(formData.get(`note_${key}`) ?? '').trim()
    if (v) notes[key] = v.slice(0, 10_000)
  }
  const status = readStatus(formData.get('status'))
  const id = String(formData.get('id') ?? '')

  const versionRaw = String(formData.get('version') ?? '')
  const expectedVersion = /^\d+$/.test(versionRaw) ? Number(versionRaw) : undefined
  const db = await getDb()

  let dealId = id
  try {
    // One transaction: deal row, audit rows and the analysis snapshot commit together.
    const outcome = await db.transaction(async (tx) => {
      const r = dealsRepo(tx)
      // Comp summary fields are never typed: they always come from the comps list.
      const inputs = { ...parsed.inputs, ...(await compSummaryFor(tx, id || null)) }
      // Fields still holding an unconfirmed ValeForge default (a marker only).
      let defaulted: DefaultableKey[] = []
      try {
        const raw = JSON.parse(String(formData.get('defaulted') ?? '[]'))
        if (Array.isArray(raw)) defaulted = raw.filter((k): k is DefaultableKey => typeof k === 'string' && isDefaultable(k) && inputs[k] !== null)
      } catch {
        defaulted = []
      }
      if (id) {
        if (!(await r.get(id))) return 'missing' as const
        await r.update(id, { inputs, notes, status }, user, { expectedVersion })
        await r.setDefaulted(id, defaulted)
      } else {
        dealId = await r.create(inputs, notes, status, user, defaulted)
      }
      await snapshotDeal(tx, dealId, user)
      return 'saved' as const
    })
    if (outcome === 'missing') return { error: 'Deal not found.' }
  } catch (e) {
    if (e instanceof DealConflictError)
      return {
        error: `${e.message} Nothing was saved. Open the deal again to see their changes, then re-apply yours.`,
      }
    throw e
  }
  revalidatePath('/')
  revalidatePath(`/deals/${dealId}`)
  redirect(`/deals/${dealId}`)
}

export async function setStatus(formData: FormData) {
  const user = await currentActor()
  const id = String(formData.get('id') ?? '')
  if (!user || !id) return
  const db = await getDb()
  await db.transaction(async (tx) => {
    if ((await dealsRepo(tx).update(id, { status: readStatus(formData.get('status')) }, user)) > 0) await snapshotDeal(tx, id, user)
  })
  revalidatePath('/')
  revalidatePath(`/deals/${id}`)
}
