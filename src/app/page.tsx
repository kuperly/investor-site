import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import { capabilities, model, underwriting } from '@/lib/content'
import { Hero } from '@/components/sections/Hero'
import { Philosophy } from '@/components/sections/Philosophy'
import { Strategies } from '@/components/sections/Strategies'
import { AboutIntro } from '@/components/sections/AboutIntro'
import { PartnershipCta } from '@/components/sections/PartnershipCta'
import { TextSection } from '@/components/ui/TextSection'

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
      <TextSection
        id="model-title"
        eyebrow="How We Work"
        title={model.title}
        lead={model.intro}
        body={model.body}
        items={capabilities}
        tone="muted"
      />
      <Strategies />
      <TextSection
        id="underwriting-title"
        eyebrow="Discipline"
        title={underwriting.title}
        lead={underwriting.lead}
        body={underwriting.body}
        tone="muted"
      />
      <AboutIntro />
      <PartnershipCta />
    </>
  )
}
