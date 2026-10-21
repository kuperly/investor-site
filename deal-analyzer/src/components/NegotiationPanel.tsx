import { recordNegotiationAction } from '@/app/sourcing-actions'
import { ActionForm } from '@/components/ActionForm'
import { money, pct } from '@/lib/format'
import { KIND_LABELS, NEGOTIATION_KINDS, STAGE_LABELS, type NegotiationEvent, type NegotiationSummary } from '@/sourcing/engine/negotiation'

/** Negotiation log for a lead or a deal: recorded facts, the stage, and a form to add one. */
export function NegotiationPanel({
  events,
  summary,
  candidateId = null,
  dealId = null,
  compact = false,
}: {
  events: NegotiationEvent[]
  summary: NegotiationSummary
  candidateId?: string | null
  dealId?: string | null
  compact?: boolean
}) {
  return (
    <div className="space-y-1 text-xs" data-testid="negotiation">
      <div>
        <span className="font-semibold">{STAGE_LABELS[summary.stage]}</span>
        {summary.lastActivity && <span className="text-ink-muted"> · last {summary.lastActivity}</span>}
      </div>
      {summary.priceCuts.count > 0 && (
        <div>
          Current asking {money(summary.priceCuts.currentAsking)}
          {summary.priceCuts.totalCutPct !== null && <> ({pct(summary.priceCuts.totalCutPct)} below the original)</>}
        </div>
      )}
      {summary.signals.length > 0 && <div className="text-ink-soft">Signals: {summary.signals.join(' · ')}</div>}
      <div className="text-ink-muted" title={summary.likelihoodNote}>
        Likelihood of progress: UNKNOWN (not scored)
      </div>
      <details>
        <summary className="cursor-pointer underline">
          {events.length ? `History (${events.length})` : 'Record'} · add
        </summary>
        {events.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {events.map((e) => (
              <li key={e.id}>
                {e.eventDate} · {KIND_LABELS[e.kind]}
                {e.amount !== null && <> {money(e.amount)}</>}
                {e.note && <> — {e.note}</>} <span className="text-ink-muted">({e.createdBy})</span>
              </li>
            ))}
          </ul>
        )}
        <ActionForm
          action={recordNegotiationAction}
          submitLabel="Record"
          className={compact ? 'mt-1 space-y-1' : 'mt-2 grid gap-2 sm:grid-cols-4'}
          buttonClassName="btn-secondary min-h-[36px] py-1 text-xs"
        >
          {candidateId && <input type="hidden" name="candidateId" value={candidateId} />}
          {dealId && <input type="hidden" name="dealId" value={dealId} />}
          <select name="kind" className="input" aria-label="What happened" required defaultValue="">
            <option value="">What happened…</option>
            {NEGOTIATION_KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
          <input name="amount" className="input" inputMode="decimal" placeholder="Amount ($)" aria-label="Amount" />
          <input name="eventDate" type="date" className="input" aria-label="Date" />
          <input name="note" className="input" placeholder="Note" aria-label="Note" />
        </ActionForm>
      </details>
    </div>
  )
}
