import { model } from '@/lib/content'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'
import { ModelFlywheel } from '@/components/sections/ModelFlywheel'

/**
 * The ValeForge Model — the idea that capital keeps working, shown as a
 * living loop (`ModelFlywheel`) rather than a numbered list.
 */
export function ValeForgeModel() {
  return (
    <Section labelledBy="model-title">
      <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <SectionHeading id="model-title" eyebrow="How We Work" title={model.title} />
          <Reveal delay={100}>
            <p className="mt-8 text-pretty font-heading text-2xl leading-snug text-foreground">{model.intro}</p>
            <p className="mt-5 max-w-md text-pretty leading-relaxed text-muted-foreground">{model.body}</p>
          </Reveal>
        </div>
        <Reveal delay={150} className="lg:col-span-7">
          <ModelFlywheel />
        </Reveal>
      </div>
    </Section>
  )
}
