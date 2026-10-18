import type { Metadata } from 'next'
import { capabilities, capitalEfficiency, exitPaths, model, underwriting } from '@/lib/content'
import { PageHeader } from '@/components/ui/PageHeader'
import { TextSection } from '@/components/ui/TextSection'
import { ClosingCta } from '@/components/sections/PartnershipCta'

export const metadata: Metadata = {
  title: 'Our Approach',
  description:
    'How ValeForge approaches U.S. real estate: find the opportunity, acquire with discipline, create value, monetize, and recycle capital into the next opportunity.',
  alternates: { canonical: '/approach' },
}

/** Owns the model, the four steps, underwriting, capital efficiency and exits — none of it repeats on Home. */
export default function ApproachPage() {
  return (
    <>
      <PageHeader eyebrow="Our Approach" title={model.title} intro={`${model.intro} ${model.body}`} />
      <TextSection
        id="steps-title"
        eyebrow="How We Work"
        title="Four steps, one continuous cycle."
        items={capabilities}
        tone="muted"
      />
      <TextSection
        id="underwriting-title"
        eyebrow="Discipline"
        title={underwriting.title}
        lead={underwriting.lead}
        body={underwriting.body}
      />
      <TextSection
        id="capital-title"
        eyebrow="Capital Efficiency"
        title={capitalEfficiency.title}
        body={capitalEfficiency.body}
        items={capitalEfficiency.concepts}
        tone="muted"
      />
      <TextSection
        id="exits-title"
        eyebrow="Optionality"
        title={exitPaths.title}
        body={exitPaths.body}
        items={exitPaths.paths}
      />
      <ClosingCta />
    </>
  )
}
