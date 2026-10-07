import { model } from '@/lib/content'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'

/**
 * The investment loop as an ordered sequence. Desktop: one horizontal row
 * with a return bracket from "Acquire Again" back to "Acquire". Mobile: a
 * vertical spine. Pure HTML/CSS — no chart.
 */
export function ValeForgeModel() {
  return (
    <Section labelledBy="model-title">
      <div className="grid gap-10 lg:grid-cols-12">
        <SectionHeading id="model-title" eyebrow="How We Work" title={model.title} className="lg:col-span-6" />
        <Reveal delay={100} className="lg:col-span-5 lg:col-start-8 lg:pt-14">
          <p className="text-pretty font-heading text-2xl leading-snug text-foreground">{model.intro}</p>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">{model.body}</p>
        </Reveal>
      </div>

      <Reveal delay={150}>
        <div className="relative mt-16 lg:mt-24">
          <ol className="relative grid gap-0 lg:grid-cols-6">
            {model.steps.map((step, index) => {
              const isFirst = index === 0
              const isLast = index === model.steps.length - 1
              return (
                <li
                  key={step}
                  className="group relative flex items-start gap-5 pb-10 pl-0 lg:flex-col lg:gap-6 lg:pb-0 lg:pr-6"
                >
                  {/* connector: vertical on mobile, horizontal on desktop */}
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[11px] top-7 h-[calc(100%-1.75rem)] w-px bg-border lg:left-7 lg:top-[11px] lg:h-px lg:w-[calc(100%-1.75rem)]"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                      isFirst || isLast
                        ? 'border-primary bg-primary'
                        : 'border-primary/60 bg-background group-hover:border-primary group-hover:bg-primary/20'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isFirst || isLast ? 'bg-primary-foreground' : 'bg-primary'}`} />
                  </span>
                  <div>
                    <span aria-hidden="true" className="block text-xs font-semibold tabular-nums tracking-eyebrow text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="mt-1 block font-heading text-xl text-foreground transition-colors duration-300 group-hover:text-primary sm:text-2xl">
                      {step}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>

          {/* return bracket: Acquire Again feeds back into Acquire (desktop) */}
          <div aria-hidden="true" className="mt-10 hidden lg:grid lg:grid-cols-6">
            <div className="col-span-5 col-start-2 h-8 border-x border-b border-dashed border-primary/50" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground lg:text-center">
            <span aria-hidden="true" className="mr-2 text-primary">
              ↺
            </span>
            Capital returns to the start of the loop — depending on the opportunity.
          </p>
        </div>
      </Reveal>
    </Section>
  )
}
