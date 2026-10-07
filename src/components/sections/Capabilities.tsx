import { capabilities } from '@/lib/content'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'

/** What We Do — four capabilities as an editorial row, not cards. */
export function Capabilities() {
  return (
    <Section labelledBy="capabilities-title" tone="muted">
      <SectionHeading
        id="capabilities-title"
        eyebrow="What We Do"
        title="Four disciplines. One continuous cycle."
      />
      <ul className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
        {capabilities.map((item, index) => (
          <li key={item.title}>
            <Reveal delay={index * 90} className="h-full">
              <div className="group relative h-full pt-8">
                {/* hairline that fills with brass on hover */}
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-border" />
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-px w-full origin-left scale-x-[0.18] bg-primary transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                />
                <span aria-hidden="true" className="font-heading text-lg tabular-nums text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 font-heading text-3xl text-foreground">{item.title}</h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  )
}
