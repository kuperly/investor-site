import type { Metadata } from 'next'
import { about } from '@/lib/content'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'
import { PartnershipCta } from '@/components/sections/PartnershipCta'

export const metadata: Metadata = {
  title: 'About',
  description:
    'ValeForge is being built as a U.S. real estate investment company focused on disciplined acquisition, value creation and long-term capital growth.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  const [lead, ...rest] = about.paragraphs

  return (
    <>
      <PageHeader eyebrow="About ValeForge" title={about.title} intro={lead} />

      <Section labelledBy="about-system-title">
        <div className="grid gap-10 lg:grid-cols-12">
          <SectionHeading
            id="about-system-title"
            eyebrow="What We Believe"
            title="A repeatable system, not a single deal."
            className="lg:col-span-5"
          />
          <Reveal delay={100} className="space-y-6 lg:col-span-6 lg:col-start-7 lg:pt-14">
            {rest.map((paragraph, index) => (
              <p
                key={paragraph}
                className={
                  index === 0
                    ? 'text-pretty font-heading text-2xl leading-snug text-foreground sm:text-3xl'
                    : 'text-pretty text-lg leading-relaxed text-muted-foreground'
                }
              >
                {paragraph}
              </p>
            ))}
          </Reveal>
        </div>
      </Section>

      <Section labelledBy="principles-title" tone="muted">
        <SectionHeading id="principles-title" eyebrow="Principles" title="How We Invest" />
        <ul className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {about.principles.map((principle, index) => (
            <li key={principle.title}>
              <Reveal delay={index * 80}>
                <div className="border-t border-border pt-6">
                  <h3 className="font-heading text-2xl text-foreground">{principle.title}</h3>
                  <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">{principle.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      <PartnershipCta />
    </>
  )
}
