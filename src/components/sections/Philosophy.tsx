import { philosophy } from '@/lib/content'
import { Section } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow } from '@/components/ui/Eyebrow'

/** The central brand statement — the site's largest type after the hero. */
export function Philosophy() {
  const [first, second] = philosophy.lines

  return (
    <Section labelledBy="philosophy-title" className="py-6 sm:py-10">
      <Reveal>
        <Eyebrow>Our Philosophy</Eyebrow>
        <h2
          id="philosophy-title"
          className="mt-10 font-heading text-[2.6rem] font-normal leading-[1.04] tracking-display text-foreground sm:text-7xl lg:text-[6.5rem]"
        >
          <span className="block">{first}</span>
          <span className="block italic text-primary">{second}</span>
        </h2>
      </Reveal>
      <Reveal delay={150}>
        <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-12">
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl lg:col-span-6 lg:col-start-7">
            {philosophy.body}
          </p>
        </div>
      </Reveal>
    </Section>
  )
}
