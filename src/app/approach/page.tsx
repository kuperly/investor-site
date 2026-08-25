import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { HeroBackground } from '@/components/ui/HeroBackground'
import { Eyebrow } from '@/components/ui/Eyebrow'

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
      <div className="relative overflow-hidden pt-24 sm:pt-28">
        <HeroBackground />
        <Reveal>
          <Eyebrow>Approach</Eyebrow>
          <h1 className="mt-6 text-balance font-heading text-4xl font-semibold leading-tight tracking-display text-foreground sm:text-5xl">
            How we evaluate every deal
          </h1>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
            {siteConfig.name} runs two related strategies from one underwriting discipline: buy-and-hold
            acquisitions for long-term capital appreciation, and a smaller book of fix-and-flip projects
            where the margin of safety is clear before we commit capital.
          </p>
        </Reveal>
      </div>

      <div className="pb-24">
        <div className="mt-16 space-y-8">
          {criteria.map((item, index) => (
            <Reveal key={item.title} delay={index * 90}>
              <div className="group border-t border-border pt-8 transition-colors duration-200 hover:border-primary/60">
                <div className="flex items-baseline gap-4">
                  <span className="font-heading text-sm tabular-nums text-primary/80">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="font-heading text-2xl text-foreground transition-colors duration-200 group-hover:text-primary">
                    {item.title}
                  </h2>
                </div>
                <p className="mt-3 leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={criteria.length * 90}>
          <div className="mt-16 rounded-lg border border-border bg-card/40 p-8">
            <h2 className="font-heading text-2xl text-foreground">Buy-and-hold vs. flips</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
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
