import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'

export const metadata: Metadata = {
  title: 'About',
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <Reveal>
        <p className="font-body text-sm uppercase tracking-wide text-primary">About</p>
        <h1 className="mt-4 font-heading text-4xl font-semibold text-foreground">
          Why {siteConfig.name} exists
        </h1>

        <div className="mt-8 space-y-6 text-lg text-muted-foreground">
          <p>
            {siteConfig.name} was founded on a simple premise: real estate rewards patience and
            discipline more than it rewards speed. Every acquisition is evaluated against the same
            underwriting standard, whether it is a long-term hold or a shorter renovation project.
          </p>
          <p>
            We are building this firm deliberately — starting with a focused market, a small number of
            well-underwritten deals, and a willingness to pass on anything that does not clear our bar.
            The plan is to earn a track record the same way we plan to earn returns: one disciplined
            decision at a time.
          </p>
          <p>
            Our starting focus is {siteConfig.marketFocus}, with room to expand as the strategy proves
            out. We work directly with real estate professionals who bring us deals, and with investors
            who want a partner that treats their capital like it is our own.
          </p>
        </div>
      </Reveal>
    </div>
  )
}
