import { about } from '@/lib/content'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'
import { TextLink } from '@/components/ui/ButtonLink'

/** Home-page "Built to Compound" summary, linking to the full About page. */
export function AboutIntro() {
  const [lead, ...rest] = about.paragraphs

  return (
    <Section labelledBy="about-title">
      <div className="grid gap-10 lg:grid-cols-12">
        <SectionHeading id="about-title" eyebrow="About Vale Forge" title={about.title} className="lg:col-span-5" />
        <Reveal delay={100} className="lg:col-span-6 lg:col-start-7 lg:pt-14">
          <p className="text-pretty font-heading text-2xl leading-snug text-foreground sm:text-3xl">{lead}</p>
          {rest.map((paragraph) => (
            <p key={paragraph} className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
          <div className="mt-8">
            <TextLink href="/about">More about Vale Forge</TextLink>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
