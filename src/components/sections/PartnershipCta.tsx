import { partnership } from '@/lib/content'
import { PageContainer } from '@/components/ui/PageContainer'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { BrandIcon } from '@/components/ui/Logo'

/**
 * Partnerships are part of the long-term model — this is relationship
 * building, not a capital raise. No "invest now" language.
 */
export function PartnershipCta() {
  return (
    <section aria-labelledby="partner-title" className="relative isolate overflow-hidden border-t border-border">
      <BrandIcon className="pointer-events-none absolute -right-16 top-1/2 -z-10 h-[26rem] w-[26rem] -translate-y-1/2 opacity-[0.06] sm:-right-4" />
      <PageContainer className="py-24 sm:py-32 lg:py-40">
        <Reveal>
          <Eyebrow>Partnerships</Eyebrow>
          <h2
            id="partner-title"
            className="mt-8 max-w-4xl text-balance font-heading text-4xl font-medium leading-[1.05] tracking-display text-foreground sm:text-6xl"
          >
            {partnership.title}
          </h2>
          <p className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {partnership.body}
          </p>
          <div className="mt-10">
            <ButtonLink href="/contact">{partnership.cta}</ButtonLink>
          </div>
        </Reveal>
      </PageContainer>
    </section>
  )
}

/**
 * One-line closing call to action for inner pages, so they don't repeat the
 * home page's full partnership section.
 */
export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="border-t border-border">
      <PageContainer className="flex flex-col items-start gap-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20">
        <h2 id="closing-title" className="max-w-2xl text-balance font-heading text-2xl text-foreground sm:text-3xl">
          {partnership.short}
        </h2>
        <ButtonLink href="/contact" className="shrink-0">
          Get in Touch
        </ButtonLink>
      </PageContainer>
    </section>
  )
}
