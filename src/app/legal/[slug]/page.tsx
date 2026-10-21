import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { siteConfig } from '@/lib/site-config'
import { legalDocuments, legalLastUpdated, type LegalSlug } from '@/lib/legal'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'

/*
 * Generic legal texts (src/lib/legal.ts). Kept noindex until counsel has
 * reviewed them; then drop the robots override below.
 */
export function generateStaticParams() {
  return Object.keys(legalDocuments).map((slug) => ({ slug }))
}

export const dynamicParams = false

function getDocument(slug: string) {
  return slug in legalDocuments ? legalDocuments[slug as LegalSlug] : undefined
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const document = getDocument(slug)
  return document ? { title: document.title, robots: { index: false, follow: true } } : {}
}

/** Renders `{email}` placeholders as a mailto link to the general inbox. */
function WithEmail({ text }: { text: string }) {
  const [before, ...rest] = text.split('{email}')
  if (rest.length === 0) return <>{text}</>
  return (
    <>
      {before}
      {rest.map((after, index) => (
        <span key={index}>
          <a
            href={`mailto:${siteConfig.emails.investment}`}
            className="font-medium text-foreground underline decoration-primary/60 underline-offset-4 hover:text-primary"
          >
            {siteConfig.emails.investment}
          </a>
          {after}
        </span>
      ))}
    </>
  )
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const document = getDocument(slug)
  if (!document) notFound()

  return (
    <>
      <PageHeader eyebrow="Legal" title={document.title} intro={document.intro} />
      <PageContainer className="pb-28">
        <div className="max-w-2xl border-t border-border pt-10 text-lg leading-relaxed text-muted-foreground">
          <p className="text-sm uppercase tracking-eyebrow">Last updated {legalLastUpdated}</p>
          {document.sections.map((section) => (
            <section key={section.heading} className="mt-12">
              <h2 className="font-heading text-2xl text-foreground">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-pretty">
                  <WithEmail text={paragraph} />
                </p>
              ))}
              {section.list ? (
                <ul className="mt-4 list-disc space-y-3 pl-6 marker:text-primary">
                  {section.list.map((item) => (
                    <li key={item} className="text-pretty">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </PageContainer>
    </>
  )
}
