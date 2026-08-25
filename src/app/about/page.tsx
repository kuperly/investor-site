import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

export const metadata: Metadata = {
  title: 'About',
}

export default function AboutPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="About" title={`Why ${siteConfig.name} exists`} />

      <div className="mt-14 max-w-2xl space-y-6 pb-24 text-lg leading-relaxed text-muted-foreground">
        <Reveal>
          <p>
            {siteConfig.name} was founded on a simple premise: real estate rewards patience and
            discipline more than it rewards speed. Every acquisition is evaluated against the same
            underwriting standard, whether it is a long-term hold or a shorter renovation project.
          </p>
        </Reveal>
        <Reveal>
          <p>
            We are building this firm deliberately — starting with a focused market, a small number of
            well-underwritten deals, and a willingness to pass on anything that does not clear our bar.
            The plan is to earn a track record the same way we plan to earn returns: one disciplined
            decision at a time.
          </p>
        </Reveal>
        <Reveal>
          <p>
            Our starting focus is {siteConfig.marketFocus}, with room to expand as the strategy proves
            out. We work directly with real estate professionals who bring us deals, and with investors
            who want a partner that treats their capital like it is our own.
          </p>
        </Reveal>
      </div>
    </PageContainer>
  )
}
