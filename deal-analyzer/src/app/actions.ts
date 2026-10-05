'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DEAL_STATUSES, type DealStatus } from '@/engine/types'
import { NOTE_CATEGORIES, type DealNotes } from '@/lib/notes'
import { parseDealForm, type FieldErrors } from '@/lib/parse-inputs'
import { repo } from '@/lib/repo'
import { currentUser } from '@/lib/session'
import { asUser, USER_COOKIE } from '@/lib/users'
import { BASE_PATH } from '@/lib/base-path'

export interface SaveState {
  error?: string
  errors?: FieldErrors
}

function readStatus(v: FormDataEntryValue | null): DealStatus {
  return (DEAL_STATUSES as readonly string[]).includes(String(v)) ? (v as DealStatus) : 'Lead'
}

export async function saveDeal(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await currentUser()
  if (!user) return { error: 'Choose who you are (Guy or Ben) in the header before saving — changes are attributed in the audit trail.' }

  const { inputs, errors } = parseDealForm((k) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : null
  })
  if (Object.keys(errors).length > 0) return { error: 'Please fix the highlighted fields.', errors }

  const notes: DealNotes = {}
  for (const { key } of NOTE_CATEGORIES) {
    const v = String(formData.get(`note_${key}`) ?? '').trim()
    if (v) notes[key] = v.slice(0, 10_000)
  }
  const status = readStatus(formData.get('status'))
  const id = String(formData.get('id') ?? '')

  const r = await repo()
  let dealId = id
  if (id) {
    if (!(await r.get(id))) return { error: 'Deal not found.' }
    await r.update(id, { inputs, notes, status }, user)
  } else {
    dealId = await r.create(inputs, notes, status, user)
  }
  revalidatePath('/')
  revalidatePath(`/deals/${dealId}`)
  redirect(`/deals/${dealId}`)
}

export async function setStatus(formData: FormData) {
  const user = await currentUser()
  const id = String(formData.get('id') ?? '')
  if (!user || !id) return
  await (await repo()).update(id, { status: readStatus(formData.get('status')) }, user)
  revalidatePath('/')
  revalidatePath(`/deals/${id}`)
}

export async function setUser(formData: FormData) {
  const user = asUser(String(formData.get('user') ?? ''))
  if (!user) return
  ;(await cookies()).set(USER_COOKIE, user, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: BASE_PATH || '/', maxAge: 60 * 60 * 24 * 365 })
  revalidatePath('/', 'layout')
}
