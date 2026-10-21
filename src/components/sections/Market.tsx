import Image from 'next/image'
import { activeMarket } from '@/lib/market'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'

/** Where ValeForge is focused right now — driven entirely by `activeMarket`. */
export function Market() {
  const photo = activeMarket.photos.market

  return (
    <Section labelledBy="market-title" tone="muted">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-6">
          <figure>
            <div className="relative aspect-[3/2] overflow-hidden rounded-sm">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-[1.5s] ease-out hover:scale-[1.03]"
              />
            </div>
          </figure>
        </Reveal>
        <div className="lg:col-span-5 lg:col-start-8">
          <SectionHeading id="market-title" eyebrow="Our Market" title={activeMarket.title} />
          <Reveal delay={100}>
            <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">{activeMarket.body}</p>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
