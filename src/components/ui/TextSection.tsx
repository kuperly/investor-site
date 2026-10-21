import type { ReactNode } from 'react'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'

type Item = { title: string; body: string }

/**
 * The site's standard content section: eyebrow + heading, a short
 * paragraph or two, and optionally a few short points as plain text.
 * Deliberately simple — no diagrams, charts or decorative widgets.
 */
export function TextSection({
  id,
  eyebrow,
  title,
  lead,
  body,
  items,
  tone,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  lead?: string
  body?: string
  items?: Item[]
  tone?: 'default' | 'muted'
  children?: ReactNode
}) {
  const columns = items?.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'

  return (
    <Section labelledBy={id} tone={tone}>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <SectionHeading id={id} eyebrow={eyebrow} title={title} className="lg:col-span-6" />
        {lead || body ? (
          <Reveal delay={100} className="lg:col-span-5 lg:col-start-8 lg:pt-14">
            {lead ? <p className="text-pretty font-heading text-2xl leading-snug text-foreground">{lead}</p> : null}
            {body ? (
              <p className={`text-pretty text-lg leading-relaxed text-muted-foreground ${lead ? 'mt-5' : ''}`}>{body}</p>
            ) : null}
          </Reveal>
        ) : null}
      </div>

      {items ? (
        <ul className={`mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-16 ${columns}`}>
          {items.map((item, index) => (
            <li key={item.title}>
              <Reveal delay={index * 80}>
                <h3 className="font-heading text-2xl text-foreground">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{item.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      ) : null}

      {children}
    </Section>
  )
}
