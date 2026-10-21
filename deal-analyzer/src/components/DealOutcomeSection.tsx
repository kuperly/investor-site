import Link from 'next/link'
import { saveOutcome } from '@/app/market-actions'
import { getDb } from '@/lib/db'
import type { AnalysisSnapshot } from '@/lib/deal-snapshots'
import { money } from '@/lib/format'
import { geoRepo, outcomesRepo } from '@/market/lib/repo'
import { candidatesRepo, targetsRepo } from '@/sourcing/lib/repo'
import { ActionForm } from './ActionForm'

/**
 * Layers 1–4 → 5 → 6 on the deal page: where the deal came from (market → target → lead) and the
 * actual result, kept next to the analysis that was predicted (feedback loop, VF-03 §20).
 */
export async function DealOutcomeSection({ dealId, snapshots }: { dealId: string; snapshots: AnalysisSnapshot[] }) {
  const db = await getDb()
  const [[link], outcome] = await Promise.all([
    db.query<{ source_candidate_id: string | null }>('select source_candidate_id from deals where id = $1', [dealId]),
    outcomesRepo(db).get(dealId),
  ])
  const cand = link?.source_candidate_id ? await candidatesRepo(db).get(link.source_candidate_id) : null
  const geo = cand ? await geoRepo(db).get(cand.geoId) : null
  const target = cand?.targetId ? await targetsRepo(db).get(cand.targetId) : null
  const predicted = snapshots.find((s) => s.id === outcome?.predictedSnapshotId) ?? snapshots[0]
  const v = (k: keyof NonNullable<typeof outcome>) => (outcome?.[k] === null || outcome?.[k] === undefined ? '' : String(outcome[k]))
  const fields: [string, string][] = [
    ['purchasePrice', 'Actual purchase ($)'],
    ['arv', 'Actual ARV / appraisal ($)'],
    ['rehab', 'Actual rehab ($)'],
    ['rent', 'Actual rent ($/mo)'],
    ['timelineMonths', 'Timeline (months)'],
    ['actualProfit', 'Actual profit ($)'],
    ['actualAnnualCashFlow', 'Actual annual cash flow ($)'],
    ['actualRefiLoan', 'Actual refinance loan ($)'],
    ['actualCapitalRecovered', 'Actual capital recovered ($)'],
  ]
  return (
    <section className="card">
      <h2 className="h2">Actual result (feedback loop)</h2>
      {cand && (
        <p className="mb-2 text-sm">
          From Market Intelligence: candidate <strong>{cand.address}</strong> in{' '}
          <Link href={`/markets/${encodeURIComponent(cand.geoId)}`} className="text-brand underline">{geo?.name ?? cand.geoId}</Link>
          {target && (
            <>
              {' '}via{' '}
              <Link href={`/sourcing/leads?targetId=${target.id}`} className="text-brand underline">its sourcing target</Link>
            </>
          )}
          {cand.screening && <> · buy-box screen: {cand.screening.overall.replace('_', ' ')}</>}
          {cand.overrideReason && <> · sent despite the screen: “{cand.overrideReason}”</>}.
        </p>
      )}
      <p className="mb-2 text-xs text-ink-muted">
        Record what actually happened once the deal closes or exits. Blank = not known yet (never 0). Compared later with the analysis
        that was predicted{predicted ? ` — saved ${predicted.createdAt.toISOString().slice(0, 10)}: score ${predicted.summary.score}, ${predicted.summary.recommendation}, all-in ${money(predicted.summary.allIn)}, equity ${money(predicted.summary.equity)}` : ''}.
      </p>
      <ActionForm action={saveOutcome} submitLabel={outcome ? 'Update actual result' : 'Save actual result'} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input type="hidden" name="dealId" value={dealId} />
        {outcome && <input type="hidden" name="version" value={outcome.version} />}
        {fields.map(([k, l]) => (
          <div key={k}>
            <label className="label" htmlFor={`o-${k}`}>{l}</label>
            <input id={`o-${k}`} name={k} className="input" inputMode="decimal" defaultValue={v(k as never)} />
          </div>
        ))}
        <div>
          <label className="label" htmlFor="o-exit">Exit</label>
          <select id="o-exit" name="exitStrategy" className="input" defaultValue={v('exitStrategy')}>
            <option value="">Not yet</option>
            {['BRRRR', 'Hold', 'Flip', 'Hybrid', 'Wholesale', 'Other'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className="label" htmlFor="o-notes">Notes</label>
          <input id="o-notes" name="notes" className="input" defaultValue={v('notes')} />
        </div>
      </ActionForm>
      {outcome && <p className="mt-1 text-xs text-ink-muted">Last recorded by {outcome.recordedBy}.</p>}
    </section>
  )
}
