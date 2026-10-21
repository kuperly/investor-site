import { notFound } from 'next/navigation'
import { DealForm } from '@/components/DealForm'
import { compSummaryFor, formatCompSummary } from '@/lib/comp-summary'
import { getDb } from '@/lib/db'
import { defaultsToForm, toFormValues } from '@/lib/parse-inputs'
import { repo } from '@/lib/repo'
import { settingsRepo } from '@/lib/settings-repo'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const deal = await (await repo()).get(id)
  if (!deal) notFound()
  const db = await getDb()
  const defaults = await settingsRepo(db).getDefaults()
  const defaultStrings = Object.fromEntries(Object.entries(defaultsToForm(defaults)).filter(([, v]) => v !== ''))
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Edit — {deal.inputs.address}</h1>
      <DealForm
        id={deal.id}
        version={deal.version}
        initialValues={toFormValues(deal.inputs)}
        initialNotes={deal.notes}
        initialStatus={deal.status}
        defaults={defaultStrings}
        initialDefaulted={deal.defaulted}
        compSummary={formatCompSummary(await compSummaryFor(db, deal.id))}
      />
    </div>
  )
}
