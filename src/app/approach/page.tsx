import type { Metadata } from 'next'
import { capabilities, capitalEfficiency, exitPaths, model, philosophy, underwriting } from '@/lib/content'
import { PageHeader } from '@/components/ui/PageHeader'
import { TextSection } from '@/components/ui/TextSection'
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
        intro={`${philosophy.thesis} ${philosophy.body}`}
      />
      <TextSection
        id="model-title"
        eyebrow="How We Work"
        title={model.title}
        lead={model.intro}
        body={model.body}
        items={capabilities}
      />
      <TextSection
        id="underwriting-title"
        eyebrow="Discipline"
        title={underwriting.title}
        lead={underwriting.lead}
        body={underwriting.body}
        tone="muted"
      />
      <TextSection
        id="capital-title"
        eyebrow="Capital Efficiency"
        title={capitalEfficiency.title}
        body={capitalEfficiency.body}
        items={capitalEfficiency.concepts}
      />
      <TextSection
        id="exits-title"
        eyebrow="Optionality"
        title={exitPaths.title}
        body={exitPaths.body}
        items={exitPaths.paths}
        tone="muted"
      />
      <PartnershipCta />
    </>
  )
}
