import { explore } from '@/lib/content'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'
import { TextLink } from '@/components/ui/ButtonLink'

/**
 * Home-page signposts to the inner pages: one line each, so the home page
 * stays a short overview and each topic lives on exactly one page.
 */
export function Explore() {
  return (
    <Section labelledBy="explore-title" tone="muted">
      <SectionHeading id="explore-title" eyebrow="Explore" title={explore.title} />
      <ul className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
        {explore.items.map((item, index) => (
          <li key={item.href}>
            <Reveal delay={index * 80} className="flex h-full flex-col border-t border-border pt-6">
              <h3 className="font-heading text-2xl text-foreground">{item.title}</h3>
              <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">{item.body}</p>
              <div className="mt-5">
                <TextLink href={item.href}>{item.cta}</TextLink>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  )
}
