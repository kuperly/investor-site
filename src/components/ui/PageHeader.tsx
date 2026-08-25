import type { ReactNode } from 'react'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow } from '@/components/ui/Eyebrow'

/**
 * The single masthead used by every content page (Approach, About, Contact):
 * eyebrow → h1 → optional intro, with one fixed type scale and spacing. This
 * is why those pages' headers are identical in size, weight, and rhythm.
 * (The home page uses its own larger hero by design.)
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string
  title: ReactNode
  intro?: ReactNode
}) {
  return (
    <div className="pt-20 sm:pt-24">
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-6 max-w-3xl text-balance font-heading text-4xl font-semibold leading-tight tracking-display text-foreground sm:text-5xl">
          {title}
        </h1>
        {intro ? (
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {intro}
          </p>
        ) : null}
      </Reveal>
    </div>
  )
}
