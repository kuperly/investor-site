import { capitalEfficiency } from '@/lib/content'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'

/*
 * Conceptual glyphs — abstract marks, deliberately not charts (no axes, no
 * values). Decorative only.
 */
function Glyph({ kind }: { kind: number }) {
  const common = {
    width: 56,
    height: 56,
    viewBox: '0 0 56 56',
    fill: 'none',
    'aria-hidden': true,
    className: 'shrink-0 text-primary',
  } as const
  if (kind === 0) {
    // equity creation: a plan with a raised volume
    return (
      <svg {...common}>
        <rect x="6" y="30" width="44" height="20" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        <rect x="18" y="10" width="20" height="40" stroke="currentColor" strokeWidth="1.25" />
        <path d="M18 18h20M18 26h20M18 34h20M18 42h20" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      </svg>
    )
  }
  if (kind === 1) {
    // cash flow: an even, recurring cadence
    return (
      <svg {...common}>
        <path d="M4 28h48" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        {[10, 19, 28, 37, 46].map((x) => (
          <path key={x} d={`M${x} 20v16`} stroke="currentColor" strokeWidth="1.25" />
        ))}
      </svg>
    )
  }
  // capital recycling: a closed loop with a return arrow
  return (
    <svg {...common}>
      <path d="M44 28a16 16 0 1 1-6.2-12.6" stroke="currentColor" strokeWidth="1.25" />
      <path d="M38 9.5l.2 6.2-6.2.6" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="28" cy="28" r="3" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

export function CapitalEfficiency() {
  return (
    <Section labelledBy="capital-title" tone="muted">
      <div className="grid gap-12 lg:grid-cols-12">
        <SectionHeading
          id="capital-title"
          eyebrow="Capital Efficiency"
          title={capitalEfficiency.title}
          lead={capitalEfficiency.body}
          className="lg:col-span-6"
        />
        <ul className="divide-y divide-border border-y border-border lg:col-span-5 lg:col-start-8">
          {capitalEfficiency.concepts.map((concept, index) => (
            <li key={concept.title}>
              <Reveal delay={index * 90}>
                <div className="flex gap-6 py-8">
                  <Glyph kind={index} />
                  <div>
                    <h3 className="font-heading text-2xl text-foreground">{concept.title}</h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{concept.question}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
