import { DealForm } from '@/components/DealForm'
import { applyDefaults, emptyInputs } from '@/engine/fields'
import { compSummaryFor, formatCompSummary } from '@/lib/comp-summary'
import { getDb } from '@/lib/db'
import { defaultsToForm, toFormValues } from '@/lib/parse-inputs'
import { settingsRepo } from '@/lib/settings-repo'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function NewDealPage() {
  await requireUser()
  const db = await getDb()
  const defaults = await settingsRepo(db).getDefaults()
  // New deals start from ValeForge defaults (marked "Default" until confirmed).
  const { inputs, filled } = applyDefaults(emptyInputs(), defaults)
  const defaultStrings = Object.fromEntries(Object.entries(defaultsToForm(defaults)).filter(([, v]) => v !== ''))
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New Deal</h1>
      <DealForm
        initialValues={toFormValues(inputs)}
        initialNotes={{}}
        initialStatus="Lead"
        defaults={defaultStrings}
        initialDefaulted={filled}
        compSummary={formatCompSummary(await compSummaryFor(db, null))}
      />
    </div>
  )
}
