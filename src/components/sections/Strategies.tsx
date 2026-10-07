import { strategies } from '@/lib/content'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'
import { TextLink } from '@/components/ui/ButtonLink'

/**
 * The strategy toolkit as a ruled index (title | description), framed as
 * categories we evaluate — never as a claim of deals executed. On the
 * /strategies page the page masthead supplies the heading (`withHeading`
 * false) and the list is introduced by the toolkit note.
 */
export function Strategies({ withHeading = true }: { withHeading?: boolean }) {
  return (
    <Section labelledBy="strategies-title" className={withHeading ? '' : 'border-t-0'}>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          {withHeading ? (
            <SectionHeading id="strategies-title" eyebrow="Strategies" title={strategies.title} />
          ) : (
            <Reveal>
              <h2 id="strategies-title" className="font-heading text-3xl font-medium text-foreground sm:text-4xl">
                The strategy toolkit
              </h2>
            </Reveal>
          )}
          <Reveal delay={100}>
            <p className="mt-6 max-w-md text-pretty leading-relaxed text-muted-foreground">
              {withHeading ? strategies.intro : strategies.toolkitNote}
            </p>
            {withHeading ? (
              <div className="mt-6">
                <TextLink href="/strategies">Explore the strategy toolkit</TextLink>
              </div>
            ) : null}
          </Reveal>
        </div>

        <ul className="border-b border-border lg:col-span-7">
          {strategies.items.map((item, index) => (
            <li key={item.title}>
              <Reveal delay={index * 60}>
                <div className="group grid gap-2 border-t border-border py-7 transition-colors duration-300 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8">
                  <h3 className="flex items-baseline gap-4 font-heading text-2xl text-foreground transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 group-hover:text-primary">
                    <span aria-hidden="true" className="text-sm tabular-nums text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {item.title}
                  </h3>
                  <p className="pl-9 leading-relaxed text-muted-foreground sm:pl-0">{item.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
