import type { Metadata } from 'next'
import { philosophy } from '@/lib/content'
import { PageHeader } from '@/components/ui/PageHeader'
import { ValeForgeModel } from '@/components/sections/ValeForgeModel'
import { Capabilities } from '@/components/sections/Capabilities'
import { CapitalEfficiency } from '@/components/sections/CapitalEfficiency'
import { Underwriting } from '@/components/sections/Underwriting'
import { ExitPaths } from '@/components/sections/ExitPaths'
import { PartnershipCta } from '@/components/sections/PartnershipCta'

export const metadata: Metadata = {
  title: 'Our Approach',
  description:
    'How ValeForge approaches U.S. real estate: find the opportunity, acquire with discipline, create value, monetize, and recycle capital into the next opportunity.',
  alternates: { canonical: '/approach' },
}

export default function ApproachPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our Approach"
        title={
          <>
            {philosophy.lines[0]} <span className="italic text-primary">{philosophy.lines[1]}</span>
          </>
        }
        intro={philosophy.body}
      />
      <ValeForgeModel />
      <Capabilities />
      <Underwriting />
      <CapitalEfficiency />
      <ExitPaths />
      <PartnershipCta />
    </>
  )
}
