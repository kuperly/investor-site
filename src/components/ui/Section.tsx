import type { ReactNode } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow } from '@/components/ui/Eyebrow'

/**
 * One editorial section band: generous vertical rhythm, a hairline rule on
 * top, and an optional tonal (sand/charcoal) surface to alternate sections
 * without resorting to cards.
 */
export function Section({
  children,
  id,
  tone = 'default',
  className = '',
  labelledBy,
}: {
  children: ReactNode
  id?: string
  tone?: 'default' | 'muted'
  className?: string
  labelledBy?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`scroll-mt-20 border-t border-border ${tone === 'muted' ? 'bg-muted/40' : ''} ${className}`}
    >
      <PageContainer className="py-20 sm:py-28 lg:py-32">{children}</PageContainer>
    </section>
  )
}

/**
 * Eyebrow + h2 + optional lead, at one fixed scale. `id` labels the parent
 * <section> via `aria-labelledby`.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  className = '',
}: {
  id: string
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  className?: string
}) {
  return (
    <Reveal className={className}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className="mt-6 max-w-3xl text-balance font-heading text-4xl font-medium leading-[1.08] tracking-display text-foreground sm:text-5xl"
      >
        {title}
      </h2>
      {lead ? (
        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">{lead}</p>
      ) : null}
    </Reveal>
  )
}
