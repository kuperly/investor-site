'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db'
import { parseDefaultsForm, type FieldErrors } from '@/lib/parse-inputs'
import { currentUser } from '@/lib/session'
import { settingsRepo } from '@/lib/settings-repo'

export interface DefaultsState {
  ok?: string
  error?: string
  errors?: FieldErrors
}

export async function saveDefaults(_prev: DefaultsState, formData: FormData): Promise<DefaultsState> {
  const user = await currentUser()
  if (!user) return { error: 'Choose who you are (Guy or Ben) in the header first — changes to defaults are recorded.' }
  const { defaults, errors } = parseDefaultsForm((k) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : null
  })
  if (Object.keys(errors).length > 0) return { error: 'Please fix the highlighted fields.', errors }
  const n = await settingsRepo(await getDb()).saveDefaults(defaults, user)
  revalidatePath('/settings')
  revalidatePath('/deals/new')
  return { ok: n === 0 ? 'No changes.' : `Saved ${n} change${n === 1 ? '' : 's'}. New deals will start with these values.` }
}
