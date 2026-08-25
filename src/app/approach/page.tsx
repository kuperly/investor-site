import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { HeroBackground } from '@/components/ui/HeroBackground'

export const metadata: Metadata = {
  title: 'Approach',
}

const criteria = [
  {
    title: 'Cash flow first',
    body: "Every acquisition has to work on today's numbers. We do not underwrite to speculative rent growth or exit-cap compression.",
  },
  {
    title: 'Downside discipline',
    body: 'We size positions and leverage so that a slower market is an inconvenience, not a threat to the portfolio.',
  },
  {
    title: 'Operational control',
    body: 'We stay close to the assets we own — management, maintenance, and tenant relationships are not outsourced blind spots.',
  },
]

export default function ApproachPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="relative overflow-hidden pt-20">
        <HeroBackground />
        <Reveal>
          <p className="font-body text-sm uppercase tracking-wide text-primary">Approach</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold text-foreground">
            How we evaluate every deal
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            {siteConfig.name} runs two related strategies from one underwriting discipline: buy-and-hold
            acquisitions for long-term capital appreciation, and a smaller book of fix-and-flip projects
            where the margin of safety is clear before we commit capital.
          </p>
        </Reveal>
      </div>

      <div className="pb-20">
        <div className="mt-14 space-y-10">
          {criteria.map((item, index) => (
            <Reveal key={item.title} delay={index * 100}>
              <div className="group rounded-lg border-t border-border pt-8 transition-colors duration-200 hover:border-primary">
                <h2 className="font-heading text-2xl text-foreground transition-colors duration-200 group-hover:text-primary">
                  {item.title}
                </h2>
                <p className="mt-3 text-muted-foreground">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={criteria.length * 100}>
          <div className="mt-14 border-t border-border pt-8">
            <h2 className="font-heading text-2xl text-foreground">Buy-and-hold vs. flips</h2>
            <p className="mt-3 text-muted-foreground">
              The default is to hold: assets that compound through appreciation and rent growth stay in
              the portfolio. We take on a flip only when a property has a clear value-add path — a
              renovation or repositioning — and the exit math holds up even if the market softens before
              we sell.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
