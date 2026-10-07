import { underwriting } from '@/lib/content'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'

/**
 * The Numbers Come First — a brand statement, not a dashboard. The factors
 * read like a drawing's title block: ruled cells, index numbers, no values.
 */
export function Underwriting() {
  return (
    <Section labelledBy="underwriting-title">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading id="underwriting-title" eyebrow="Discipline" title={underwriting.title} />
          <Reveal delay={100}>
            <p className="mt-6 font-heading text-2xl text-foreground">{underwriting.lead}</p>
            <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground">{underwriting.body}</p>
          </Reveal>
        </div>

        <Reveal delay={150} className="lg:col-span-6 lg:col-start-7 lg:self-end">
          <p className="mb-4 text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
            What we evaluate before capital is committed
          </p>
          <ul className="grid grid-cols-2 border-l border-t border-border sm:grid-cols-4">
            {underwriting.factors.map((factor, index) => (
              <li
                key={factor}
                className="group flex min-h-[5.5rem] flex-col sm:min-h-[7.5rem] justify-between border-b border-r border-border p-4 transition-colors duration-300 hover:bg-muted/60 sm:p-5"
              >
                <span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-heading text-lg leading-tight text-foreground sm:text-xl">{factor}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  )
}
