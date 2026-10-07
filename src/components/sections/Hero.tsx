import { siteConfig } from '@/lib/site-config'
import { model } from '@/lib/content'
import { HeroBackground } from '@/components/ui/HeroBackground'
import { PageContainer } from '@/components/ui/PageContainer'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ButtonLink } from '@/components/ui/ButtonLink'

const heroCopy =
  'ValeForge is a U.S. real estate investment company focused on identifying, acquiring, improving and operating opportunities where disciplined execution can create meaningful equity and recurring cash flow.'

export function Hero() {
  // The loop, minus "Find Opportunity" / "Acquire Again" bookends, as a quiet
  // one-line summary under the CTAs.
  const loop = model.steps.slice(1, 5)

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <HeroBackground />
      <PageContainer className="flex min-h-[calc(100svh-4.5rem)] flex-col justify-center py-20 sm:py-28">
        <Reveal>
          <Eyebrow>U.S. Real Estate Investment</Eyebrow>
          <h1
            id="hero-title"
            className="mt-8 max-w-4xl text-balance font-heading text-[2.75rem] font-medium leading-[1.02] tracking-display text-foreground sm:text-7xl lg:text-8xl"
          >
            {siteConfig.tagline}
          </h1>
          <p className="mt-8 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {heroCopy}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <ButtonLink href="/approach">Explore Our Approach</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Partner With Us
            </ButtonLink>
          </div>
        </Reveal>

        <Reveal delay={250} className="mt-16 sm:mt-24">
          <p className="sr-only">Our investment loop:</p>
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
            {loop.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                {step}
                {index < loop.length - 1 ? (
                  <span aria-hidden="true" className="text-primary">
                    →
                  </span>
                ) : (
                  <span aria-hidden="true" className="text-primary">
                    ↺
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Reveal>
      </PageContainer>
    </section>
  )
}
