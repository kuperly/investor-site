import type { Metadata } from 'next'
import { strategies } from '@/lib/content'
import { PageHeader } from '@/components/ui/PageHeader'
import { Strategies } from '@/components/sections/Strategies'
import { ExitPaths } from '@/components/sections/ExitPaths'
import { PartnershipCta } from '@/components/sections/PartnershipCta'

export const metadata: Metadata = {
  title: 'Strategies',
  description:
    'ValeForge is strategy-agnostic: we evaluate opportunities across value-add, fix & flip, BRRRR, buy & hold, small multifamily and creative financing — the strategy follows the opportunity.',
  alternates: { canonical: '/strategies' },
}

export default function StrategiesPage() {
  return (
    <>
      <PageHeader eyebrow="Strategies" title={strategies.title} intro={strategies.intro} />
      <Strategies withHeading={false} />
      <ExitPaths />
      <PartnershipCta />
    </>
  )
}
