import { fieldLabel } from '@/engine/fields'
import type { InputKey } from '@/engine/types'
import { UNKNOWN } from '@/lib/format'

/**
 * Renders a formatted value. UNKNOWN is highlighted so it can't be mistaken for a
 * number; a value calculated without some UNKNOWN inputs gets an amber "*" whose
 * tooltip / screen-reader text lists them.
 */
export function Val({ v, inc, className = '' }: { v: string; inc?: readonly InputKey[]; className?: string }) {
  if (v === UNKNOWN) return <span className={`unknown ${className}`}>UNKNOWN</span>
  const neg = v.startsWith('−')
  const missing = inc && inc.length > 0 ? inc.map(fieldLabel).join(', ') : null
  return (
    <span className={`${neg ? 'text-rose-700' : ''} ${className}`}>
      {v}
      {missing && (
        <sup className="ml-0.5 cursor-help font-bold text-amber-700" title={`Incomplete — calculated without: ${missing}`}>
          *<span className="sr-only"> incomplete, calculated without: {missing}</span>
        </sup>
      )}
    </span>
  )
}

export function IncompleteLegend({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <p className="mt-2 text-xs text-amber-800">
      <span className="font-bold">*</span> Incomplete: calculated without inputs that are still UNKNOWN (hover for the list). Missing costs
      are left out, so these figures are optimistic until completed.
    </p>
  )
}
