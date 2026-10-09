'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { PROPERTY_TYPES, type PropertyType } from '@/engine/types'
import { getDb } from '@/lib/db'
import { currentUser } from '@/lib/session'
import { VersionConflictError } from '@/market/lib/repo'
import type { LeadInput } from '@/sourcing/engine/leads'
import { validateCandidate } from '@/sourcing/engine/handoff'
import { candidatesRepo, targetsRepo, type TargetStatus } from '@/sourcing/lib/repo'
import { addLead, handOff, importLeads, openTarget, rescreen } from '@/sourcing/lib/service'

export interface FormState {
  ok?: string
  error?: string
  errors?: Record<string, string>
}

const NO_USER = 'Your session has ended — sign in again.'
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const opt = (fd: FormData, k: string) => str(fd, k) || null

function refresh(geoId?: string) {
  revalidatePath('/sourcing')
  revalidatePath('/sourcing/targets')
  revalidatePath('/sourcing/leads')
  if (geoId) revalidatePath(`/markets/${encodeURIComponent(geoId)}`)
}

// ---------------------------------------------------------------- layer 3: targets

export async function openTargetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const geoId = str(fd, 'geoId')
  const r = await openTarget(await getDb(), { geoId, avatarId: opt(fd, 'avatarId'), reason: opt(fd, 'reason'), notes: opt(fd, 'notes') }, user.displayName)
  refresh(geoId)
  return r.error ? { error: r.error } : { ok: 'Target opened. Leads can now be added under it.' }
}

export async function setTargetStatus(fd: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) return
  const status = str(fd, 'status') as TargetStatus
  if (!['active', 'paused', 'closed'].includes(status)) return
  try {
    await targetsRepo(await getDb()).setStatus(str(fd, 'id'), status, Number(str(fd, 'version')), user.displayName)
  } catch (e) {
    if (!(e instanceof VersionConflictError)) throw e
  }
  refresh()
}

// ---------------------------------------------------------------- layer 4: leads

function readLead(fd: FormData): { lead: LeadInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const n = (k: keyof LeadInput) => {
    const v = str(fd, k).replace(/[$,\s]/g, '')
    if (v === '') return null
    const x = Number(v)
    if (!Number.isFinite(x)) {
      errors[k] = 'Not a number'
      return null
    }
    return x
  }
  const pt = str(fd, 'propertyType')
  const lead: LeadInput = {
    address: str(fd, 'address'),
    city: opt(fd, 'city'),
    state: opt(fd, 'state')?.toUpperCase() ?? null,
    zip: opt(fd, 'zip'),
    propertyType: (PROPERTY_TYPES as readonly string[]).includes(pt) ? (pt as PropertyType) : null,
    beds: n('beds'),
    baths: n('baths'),
    sqft: n('sqft'),
    yearBuilt: n('yearBuilt'),
    askingPrice: n('askingPrice'),
    condition: opt(fd, 'condition'),
    estArv: n('estArv'),
    estRehab: n('estRehab'),
    estRent: n('estRent'),
    source: str(fd, 'source'),
    sourceUrl: opt(fd, 'sourceUrl'),
    notes: opt(fd, 'notes'),
  }
  Object.assign(errors, validateCandidate({ ...lead, geoId: 'x' }))
  return { lead, errors }
}

export async function addLeadAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const { lead, errors } = readLead(fd)
  if (Object.keys(errors).length) return { error: 'Please fix the highlighted fields.', errors }
  const r = await addLead(await getDb(), str(fd, 'targetId'), lead, user.displayName)
  refresh()
  return r.error ? { error: r.error } : { ok: `Lead ${lead.address} added and screened.` }
}

export async function importLeadsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const file = fd.get('file')
  const text = file instanceof File && file.size > 0 ? await file.text() : str(fd, 'csv')
  if (!text) return { error: 'Choose a CSV file or paste the rows.' }
  if (text.length > 2_000_000) return { error: 'File too large (2 MB max).' }
  const source = str(fd, 'source')
  if (!source) return { error: 'Name the list (source), e.g. "County tax-delinquent list, Sep 2026".' }
  const r = await importLeads(await getDb(), str(fd, 'targetId'), text, source, user.displayName)
  refresh()
  if (r.error) return { error: r.error }
  const s = r.ok!
  const parts = [`Imported ${s.added} lead${s.added === 1 ? '' : 's'}.`]
  if (s.duplicates.length) parts.push(`${s.duplicates.length} already in the pipeline (lines ${s.duplicates.map((d) => d.line).join(', ')}).`)
  if (s.invalid.length) parts.push(`${s.invalid.length} invalid: ${s.invalid.slice(0, 5).map((i) => `line ${i.line} (${i.errors.join('; ')})`).join(' · ')}`)
  return s.added || !s.invalid.length ? { ok: parts.join(' ') } : { error: parts.join(' ') }
}

export async function handOffLead(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser()
  if (!user) return { error: NO_USER }
  const r = await handOff(await getDb(), str(fd, 'id'), Number(str(fd, 'version')), user.displayName, opt(fd, 'reason'))
  refresh()
  revalidatePath('/')
  if (r.dealId) redirect(`/deals/${r.dealId}`)
  return { error: r.error ?? 'Could not send it.' }
}

export async function rejectLead(fd: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) return
  try {
    await candidatesRepo(await getDb()).setStatus(str(fd, 'id'), 'rejected', Number(str(fd, 'version')), user.displayName)
  } catch (e) {
    if (!(e instanceof VersionConflictError)) throw e
  }
  refresh()
}

export async function rescreenLead(fd: FormData): Promise<void> {
  const user = await currentUser()
  if (!user) return
  await rescreen(await getDb(), str(fd, 'id'), user.displayName)
  refresh()
}
