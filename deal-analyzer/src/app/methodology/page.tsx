import { METHODOLOGY } from '@/engine/config'

const BADGE = {
  SPEC: 'bg-emerald-100 text-emerald-800',
  PROVISIONAL: 'bg-amber-100 text-amber-900',
  INTERPRETATION: 'bg-sky-100 text-sky-900',
} as const

export default function MethodologyPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Methodology</h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          Every rule the engine applies, and where it comes from. <strong>SPEC</strong> rules are from Spec v1.0 and change only
          with approval. <strong>PROVISIONAL</strong> rules fill gaps the spec leaves open and need Guy/Ben sign-off.
          <strong> INTERPRETATION</strong> rows record how an ambiguous spec line was implemented. All values live in{' '}
          <code className="rounded bg-slate-100 px-1">src/engine/config.ts</code>.
        </p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr><th>Area</th><th>Rule</th><th>Source</th></tr>
          </thead>
          <tbody>
            {METHODOLOGY.map((m) => (
              <tr key={m.area + m.rule}>
                <td className="align-top font-medium">{m.area}</td>
                <td className="whitespace-normal">{m.rule}</td>
                <td className="align-top"><span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${BADGE[m.source]}`}>{m.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
