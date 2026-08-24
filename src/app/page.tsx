import Link from 'next/link'
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'

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
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="font-body text-sm uppercase tracking-wide text-primary">{siteConfig.name}</p>
        <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
          {siteConfig.tagline}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{siteConfig.description}</p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/approach"
            className="min-h-[44px] rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors duration-200 hover:bg-secondary"
          >
            See our approach
          </Link>
          <Link
            href="/contact"
            className="min-h-[44px] rounded-md border border-border px-6 py-3 font-medium text-foreground transition-colors duration-200 hover:border-primary hover:text-primary"
          >
            Get in touch
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
          {pillars.map((pillar) => (
            <div key={pillar.title}>
              <h2 className="font-heading text-xl text-foreground">{pillar.title}</h2>
              <p className="mt-3 text-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
