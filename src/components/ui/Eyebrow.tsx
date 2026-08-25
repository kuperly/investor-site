/**
 * A tracked, uppercase section label preceded by a short gold rule.
 * The rule + wide tracking is the small institutional signal that
 * separates an editorial masthead from a plain caption.
 */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-body text-xs font-semibold uppercase tracking-eyebrow text-primary">
      <span aria-hidden="true" className="h-px w-8 bg-primary/70" />
      {children}
    </p>
  )
}
