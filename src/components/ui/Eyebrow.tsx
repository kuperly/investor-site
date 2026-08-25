/**
 * A tracked, uppercase section label — the small institutional signal that
 * separates an editorial masthead from a plain caption.
 */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-xs font-semibold uppercase tracking-eyebrow text-primary">
      {children}
    </p>
  )
}
