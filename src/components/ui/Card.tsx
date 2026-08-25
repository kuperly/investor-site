import type { ReactNode } from 'react'

/**
 * The single card surface used for every "section item" across the site
 * (home pillars, audiences, approach criteria). Keeping one definition here
 * is what makes those sections look identical page to page.
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`h-full rounded-xl border border-border bg-card/40 p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-black/10 ${className}`}
    >
      {children}
    </div>
  )
}
