import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

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
    <PageContainer>
      <PageHeader
        eyebrow="Approach"
        title="How we evaluate every deal"
        intro={`${siteConfig.name} runs two related strategies from one underwriting discipline: buy-and-hold acquisitions for long-term capital appreciation, and a smaller book of fix-and-flip projects where the margin of safety is clear before we commit capital.`}
      />

      <div className="pb-24">
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {criteria.map((item, index) => (
            <Reveal key={item.title} delay={index * 90} className="h-full">
              <Card>
                <h2 className="font-heading text-2xl text-foreground">{item.title}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">{item.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={criteria.length * 90}>
          <Card className="mt-6">
            <h2 className="font-heading text-2xl text-foreground">Buy-and-hold vs. flips</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
              The default is to hold: assets that compound through appreciation and rent growth stay in
              the portfolio. We take on a flip only when a property has a clear value-add path — a
              renovation or repositioning — and the exit math holds up even if the market softens before
              we sell.
            </p>
          </Card>
        </Reveal>
      </div>
    </PageContainer>
  )
}
