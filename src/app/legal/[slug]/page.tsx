import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { siteConfig } from '@/lib/site-config'
import { nonSolicitation } from '@/lib/content'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'

/*
 * Placeholder legal pages, so the footer's legal navigation is real today.
 * Each says plainly that the document is being prepared — no invented legal
 * terms. Replace the body with counsel-approved text before launch (and drop
 * the noindex).
 */
const pages = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
  disclaimer: 'Disclaimer',
} as const

type Slug = keyof typeof pages

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const title = pages[slug as Slug]
  return title ? { title, robots: { index: false, follow: true } } : {}
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const title = pages[slug as Slug]
  if (!title) notFound()

  return (
    <>
      <PageHeader eyebrow="Legal" title={title} />
      <PageContainer className="pb-28">
        <div className="max-w-2xl space-y-6 border-t border-border pt-10 text-lg leading-relaxed text-muted-foreground">
          <p>
            This document is being prepared and will be published here. In the meantime, questions can be
            sent to{' '}
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="font-medium text-foreground underline decoration-primary/60 underline-offset-4 hover:text-primary"
            >
              {siteConfig.contactEmail}
            </a>
            .
          </p>
          {slug === 'disclaimer' ? <p>{nonSolicitation}</p> : null}
        </div>
      </PageContainer>
    </>
  )
}
