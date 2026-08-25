import Link from 'next/link'
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'

export const metadata: Metadata = {
  title: 'Home',
}

const pillars = [
  {
    title: 'Buy-and-hold appreciation',
    body: 'We acquire real estate built to compound in value over years, not quarters — underwritten for durable cash flow and long-term equity growth.',
  },
  {
    title: 'Disciplined flips',
    body: 'A smaller, selective book of renovation projects where the numbers work without relying on market timing.',
  },
  {
    title: `Focused on ${siteConfig.marketFocus}`,
    body: 'We go where the fundamentals are strongest, starting close to home and expanding only where discipline allows.',
  },
]

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(650px circle at 15% 10%, rgb(var(--color-primary) / 0.14), transparent 60%), ' +
              'radial-gradient(500px circle at 85% 40%, rgb(var(--color-secondary) / 0.10), transparent 55%)',
          }}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
          viewBox="0 0 1000 400"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g style={{ stroke: 'rgb(var(--color-primary))' }} fill="none" strokeWidth={1}>
            <path d="M480 40 C 620 10, 780 60, 980 20" opacity={0.15} />
            <path d="M460 90 C 610 55, 790 115, 990 70" opacity={0.22} />
            <path d="M440 145 C 600 105, 800 170, 1000 125" opacity={0.3} />
            <path d="M430 200 C 600 160, 810 225, 1000 180" opacity={0.38} />
            <path d="M430 255 C 610 215, 820 275, 1000 235" opacity={0.3} />
            <path d="M450 305 C 620 270, 810 325, 1000 290" opacity={0.22} />
            <path d="M480 355 C 630 325, 800 370, 1000 340" opacity={0.15} />
          </g>
        </svg>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <p className="font-body text-sm uppercase tracking-wide text-primary">{siteConfig.name}</p>
            <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              {siteConfig.tagline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{siteConfig.description}</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/approach"
                className="min-h-[44px] rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:shadow-lg hover:shadow-primary/25 active:translate-y-0"
              >
                See our approach
              </Link>
              <Link
                href="/contact"
                className="min-h-[44px] rounded-md border border-border px-6 py-3 font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
              >
                Get in touch
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-3">
          {pillars.map((pillar, index) => (
            <Reveal key={pillar.title} delay={index * 100}>
              <div className="group h-full rounded-lg border border-transparent p-6 transition-all duration-200 hover:-translate-y-1 hover:border-border hover:bg-background hover:shadow-lg">
                <h2 className="font-heading text-xl text-foreground transition-colors duration-200 group-hover:text-primary">
                  {pillar.title}
                </h2>
                <p className="mt-3 text-muted-foreground">{pillar.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}
