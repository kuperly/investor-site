import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/ContactForm'
import { siteConfig } from '@/lib/site-config'
import { contact } from '@/lib/content'
import { Reveal } from '@/components/ui/Reveal'
import { PageContainer } from '@/components/ui/PageContainer'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Vale Forge Capital about a property opportunity, capital partnership, financing, operating partnership or general inquiry.',
  alternates: { canonical: '/contact' },
}

const inboxes = [
  { label: 'Investment & capital partners', email: siteConfig.emails.investment },
  { label: 'Deals & property opportunities', email: siteConfig.emails.deals },
]

export default function ContactPage() {
  return (
    <PageContainer className="pb-24 pt-16 sm:pb-32 sm:pt-24 lg:pt-28">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <Reveal>
            <Eyebrow>Contact</Eyebrow>
            <h1 className="mt-8 text-balance font-heading text-[2.6rem] font-medium leading-[1.04] tracking-display text-foreground sm:text-6xl">
              {contact.title}
            </h1>
            <p className="mt-8 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
              {contact.intro}
            </p>

            <dl className="mt-10 max-w-md space-y-6 border-t border-border pt-6">
              {inboxes.map((inbox) => (
                <div key={inbox.email}>
                  <dt className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
                    {inbox.label}
                  </dt>
                  <dd>
                    <a
                      href={`mailto:${inbox.email}`}
                      className="mt-1 inline-flex min-h-[44px] items-center font-medium text-foreground transition-colors duration-200 hover:text-primary"
                    >
                      {inbox.email}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <Reveal delay={100}>
            <div className="border-t border-border pt-10 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </div>
    </PageContainer>
  )
}
