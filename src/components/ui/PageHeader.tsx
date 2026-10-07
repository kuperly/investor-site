import type { ReactNode } from 'react'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageContainer } from '@/components/ui/PageContainer'

/**
 * The single masthead used by every content page (Approach, Strategies,
 * About, Contact, legal): eyebrow → h1 → optional intro, with one fixed type
 * scale and spacing. (The home page uses its own larger hero by design.)
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
    <PageContainer className="pb-16 pt-16 sm:pb-20 sm:pt-24 lg:pt-28">
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-8 max-w-4xl text-balance font-heading text-[2.6rem] font-medium leading-[1.04] tracking-display text-foreground sm:text-6xl lg:text-7xl">
          {title}
        </h1>
        {intro ? (
          <p className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {intro}
          </p>
        ) : null}
      </Reveal>
    </PageContainer>
  )
}
