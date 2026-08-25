import Link from 'next/link'
import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { HeroBackground } from '@/components/ui/HeroBackground'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageContainer } from '@/components/ui/PageContainer'
import { Card } from '@/components/ui/Card'

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

const audiences = [
  {
    label: 'Investors',
    body: 'Partners who want their capital treated with the discipline we would demand of our own — clear underwriting, honest reporting, and no surprises.',
  },
  {
    label: 'Wholesalers & sellers',
    body: 'Bring us a deal. When the numbers clear our bar we move quickly and close cleanly — and we tell you plainly when they do not.',
  },
  {
    label: 'Real estate professionals',
    body: 'Agents and operators we work alongside on sourcing, diligence, and management — relationships built to outlast any single transaction.',
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <HeroBackground />
        <PageContainer className="py-24 sm:py-32">
          <Reveal>
            <Eyebrow>{siteConfig.name}</Eyebrow>
            <h1 className="mt-6 max-w-4xl text-balance font-heading text-5xl font-semibold leading-[1.05] tracking-display text-foreground sm:text-6xl lg:text-7xl">
              {siteConfig.tagline}
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {siteConfig.description}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/approach"
                className="inline-flex min-h-[44px] items-center rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:shadow-lg hover:shadow-primary/25 active:translate-y-0"
              >
                See our approach
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-[44px] items-center rounded-md border border-border px-6 py-3 font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
              >
                Get in touch
              </Link>
            </div>
          </Reveal>
        </PageContainer>
      </section>

      {/* What we do — three pillars */}
      <section>
        <PageContainer className="py-20 sm:py-24">
          <Reveal>
            <Eyebrow>What we do</Eyebrow>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {pillars.map((pillar, index) => (
              <Reveal key={pillar.title} delay={index * 90} className="h-full">
                <Card>
                  <h2 className="font-heading text-2xl text-foreground">{pillar.title}</h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{pillar.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Who we work with */}
      <section>
        <PageContainer className="py-20 sm:py-24">
          <Reveal>
            <Eyebrow>Who we work with</Eyebrow>
            <h2 className="mt-6 max-w-3xl text-balance font-heading text-3xl font-semibold text-foreground sm:text-4xl">
              Built for both sides of the table.
            </h2>
            <p className="mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
              {siteConfig.name} sits between the people with capital and the people with deals — and
              takes both relationships seriously.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {audiences.map((audience, index) => (
              <Reveal key={audience.label} delay={index * 90} className="h-full">
                <Card>
                  <h3 className="font-heading text-xl text-foreground">{audience.label}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{audience.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Closing CTA */}
      <section>
        <PageContainer className="pb-24 pt-4">
          <Reveal>
            <div className="flex flex-col items-start gap-8 rounded-2xl border border-border bg-card/40 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="max-w-2xl text-balance font-heading text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                  Let&apos;s talk about the opportunity in front of you.
                </h2>
                <p className="mt-4 max-w-xl text-pretty text-lg text-muted-foreground">
                  Whether you are placing capital or bringing a deal, start a conversation — we read
                  every message and follow up directly.
                </p>
              </div>
              <Link
                href="/contact"
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-md bg-primary px-7 py-3 font-medium text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:shadow-lg hover:shadow-primary/25 active:translate-y-0"
              >
                Get in touch
              </Link>
            </div>
          </Reveal>
        </PageContainer>
      </section>
    </>
  )
}
