import { exitPaths } from '@/lib/content'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Reveal } from '@/components/ui/Reveal'

function Node({ children }: { children: string }) {
  return (
    <div className="border border-border bg-background px-6 py-4 text-center text-xs font-semibold uppercase tracking-eyebrow text-foreground">
      {children}
    </div>
  )
}

function Stem() {
  return <span aria-hidden="true" className="mx-auto block h-8 w-px bg-primary/60" />
}

/**
 * Optionality as a conceptual tree: Buy → Create Value → Hold | Refinance |
 * Sell. Built with borders so it reflows cleanly; the branch bar collapses
 * to a single vertical spine on mobile.
 */
export function ExitPaths() {
  return (
    <Section labelledBy="exits-title" tone="muted">
      <SectionHeading id="exits-title" eyebrow="Optionality" title={exitPaths.title} lead={exitPaths.body} />

      <Reveal delay={150}>
        <figure className="mx-auto mt-16 max-w-4xl lg:mt-20">
          <div className="mx-auto max-w-[16rem]">
            <Node>Buy</Node>
            <Stem />
            <Node>Create Value</Node>
            <Stem />
          </div>

          {/* branch bar (sm+): a rail across the three column centres + a drop to each */}
          <div aria-hidden="true" className="relative hidden h-8 sm:grid sm:grid-cols-3 sm:gap-6">
            <span className="absolute top-0 h-px bg-primary/60 [left:calc((100%-3rem)/6)] [right:calc((100%-3rem)/6)]" />
            <span className="mx-auto h-full w-px bg-primary/60" />
            <span className="mx-auto h-full w-px bg-primary/60" />
            <span className="mx-auto h-full w-px bg-primary/60" />
          </div>

          <ul className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            {exitPaths.paths.map((path) => (
              <li
                key={path.title}
                className="group border border-border bg-background p-6 text-center transition-colors duration-300 hover:border-primary/70"
              >
                <h3 className="font-heading text-2xl text-foreground transition-colors duration-300 group-hover:text-primary">
                  {path.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{path.body}</p>
              </li>
            ))}
          </ul>
          <figcaption className="mt-8 text-center text-sm text-muted-foreground">{exitPaths.note}</figcaption>
        </figure>
      </Reveal>
    </Section>
  )
}
