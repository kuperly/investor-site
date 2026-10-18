import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { Hero } from '@/components/sections/Hero'
import { Philosophy } from '@/components/sections/Philosophy'
import { Market } from '@/components/sections/Market'
import { Explore } from '@/components/sections/Explore'
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
      <Market />
      <Explore />
      <PartnershipCta />
    </>
  )
}
