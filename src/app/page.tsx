import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Hero } from '@/components/sections/Hero'
import { Philosophy } from '@/components/sections/Philosophy'
import { ValeForgeModel } from '@/components/sections/ValeForgeModel'
import { Capabilities } from '@/components/sections/Capabilities'
import { Strategies } from '@/components/sections/Strategies'
import { CapitalEfficiency } from '@/components/sections/CapitalEfficiency'
import { Underwriting } from '@/components/sections/Underwriting'
import { ExitPaths } from '@/components/sections/ExitPaths'
import { AboutIntro } from '@/components/sections/AboutIntro'
import { PartnershipCta } from '@/components/sections/PartnershipCta'

export const metadata: Metadata = {
  // The home page uses the full brand title rather than the "%s | ValeForge" template.
  title: { absolute: `${siteConfig.name} | U.S. Real Estate Investment` },
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <Philosophy />
      <ValeForgeModel />
      <Capabilities />
      <Strategies />
      <CapitalEfficiency />
      <Underwriting />
      <ExitPaths />
      <AboutIntro />
      <PartnershipCta />
    </>
  )
}
