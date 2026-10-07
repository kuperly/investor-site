import { DefaultsForm } from '@/components/DefaultsForm'
import { describeAuditValue } from '@/lib/audit-format'
import { fieldLabel } from '@/engine/fields'
import type { InputKey } from '@/engine/types'
import { getDb } from '@/lib/db'
import { dateTime } from '@/lib/format'
import { defaultsToForm } from '@/lib/parse-inputs'
import { settingsRepo } from '@/lib/settings-repo'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requireUser()
  const repo = settingsRepo(await getDb())
  const [defaults, history] = await Promise.all([repo.getDefaults(), repo.history(30)])
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Default assumptions</h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          ValeForge&apos;s standard numbers. New deals start with these filled in, each marked <strong>Default</strong> until
          you confirm or change it on the deal. Leave a field blank to have no default. Property facts (price, rehab, ARV,
          rents, taxes, insurance, holding costs) are always entered per deal. Changes apply to new deals only — existing
          deals keep their values (use “Fill blanks from defaults” on a deal to apply them).
        </p>
      </div>
      <DefaultsForm initial={defaultsToForm(defaults)} />
      <section className="card">
        <h2 className="h2">Change history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">No changes yet.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="border-b border-slate-100 pb-2">
                <span className="font-medium">{fieldLabel(h.field as InputKey)}</span>: {describeAuditValue(h.field, h.oldValue)} →{' '}
                {describeAuditValue(h.field, h.newValue)}
                <div className="text-xs text-ink-muted">Changed by {h.changedBy} · {dateTime(h.changedAt)}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
