import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const metadata: Metadata = {
  title: 'About',
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="pb-8 pt-20 sm:pt-24">
        <Reveal>
          <Eyebrow>About</Eyebrow>
          <h1 className="mt-6 text-balance font-heading text-4xl font-semibold leading-tight tracking-display text-foreground sm:text-5xl">
            Why {siteConfig.name} exists
          </h1>
        </Reveal>
      </div>

      <div className="mt-8 space-y-6 pb-24 text-lg leading-relaxed text-muted-foreground">
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
    </div>
  )
}
