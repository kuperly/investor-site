import Image from 'next/image'
import { siteConfig } from '@/lib/site-config'
import { hero } from '@/lib/content'
import { activeMarket } from '@/lib/market'
import { PageContainer } from '@/components/ui/PageContainer'
import { Reveal } from '@/components/ui/Reveal'
import { ButtonLink } from '@/components/ui/ButtonLink'

/**
 * Full-bleed market photograph under a deep-navy overlay (heavier on the
 * text side), with the positioning line on top. `.on-photo` pins the dark
 * palette so the copy stays legible in light mode too.
 */
export function Hero() {
  const photo = activeMarket.photos.hero

  return (
    <section aria-labelledby="hero-title" className="on-photo relative isolate overflow-hidden bg-[#0A0F1C]">
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[70%_center]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(10,15,28,0.9)_0%,rgba(10,15,28,0.7)_42%,rgba(10,15,28,0.15)_100%)] max-sm:bg-[linear-gradient(180deg,rgba(10,15,28,0.55)_0%,rgba(10,15,28,0.82)_45%,rgba(10,15,28,0.9)_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[#0A0F1C]/70 to-transparent" />

      <PageContainer className="flex min-h-[calc(100svh-4.5rem)] flex-col justify-center py-20 sm:py-28">
        <Reveal>
          <h1
            id="hero-title"
            className="max-w-4xl text-balance font-heading text-[2.75rem] font-medium leading-[1.02] tracking-display text-foreground sm:text-7xl lg:text-8xl"
          >
            {siteConfig.tagline}
          </h1>
          <p className="mt-8 max-w-2xl text-pretty text-xl leading-relaxed text-foreground/95 sm:text-2xl">
            {hero.lead}
          </p>
          <div className="mt-10">
            <ButtonLink href="/approach">Explore Our Approach</ButtonLink>
          </div>
        </Reveal>
      </PageContainer>
    </section>
  )
}
