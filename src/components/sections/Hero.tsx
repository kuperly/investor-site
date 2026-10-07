import { siteConfig } from '@/lib/site-config'
import { hero } from '@/lib/content'
import { HeroBackground } from '@/components/ui/HeroBackground'
import { PageContainer } from '@/components/ui/PageContainer'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ButtonLink } from '@/components/ui/ButtonLink'

export function Hero() {
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
          <p className="mt-8 max-w-2xl text-pretty text-xl leading-relaxed text-foreground/90 sm:text-2xl">
            {hero.lead}
          </p>
          <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {hero.support}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <ButtonLink href="/approach">Explore Our Approach</ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Partner With Us
            </ButtonLink>
          </div>
        </Reveal>
      </PageContainer>
    </section>
  )
}
