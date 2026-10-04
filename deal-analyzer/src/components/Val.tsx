import { UNKNOWN } from '@/lib/format'

/** Renders a formatted value, highlighting UNKNOWN so it can't be mistaken for a number. */
export function Val({ v, className = '' }: { v: string; className?: string }) {
  if (v === UNKNOWN) return <span className={`unknown ${className}`}>UNKNOWN</span>
  const neg = v.startsWith('−')
  return <span className={`${neg ? 'text-rose-700' : ''} ${className}`}>{v}</span>
}
