import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/ContactForm'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { PageContainer } from '@/components/ui/PageContainer'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const metadata: Metadata = {
  title: 'Contact',
}

export default function ContactPage() {
  return (
    <PageContainer className="pb-24 pt-12">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
        {/* Left — intro */}
        <div>
          <Reveal>
            <Eyebrow>Contact</Eyebrow>
            <h1 className="mt-6 text-balance font-heading text-4xl font-semibold leading-tight tracking-display text-foreground sm:text-5xl">
              Let&apos;s talk
            </h1>
            <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
              Whether you are exploring an investment or have a deal you think fits {siteConfig.name},
              tell us a bit about it below.
            </p>
            <div className="mt-8 max-w-md border-t border-border pt-6 text-muted-foreground">
              <p className="leading-relaxed">
                We read every message and follow up directly — usually within a couple of days.
              </p>
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="mt-3 inline-block font-medium text-foreground transition-colors duration-200 hover:text-primary"
              >
                {siteConfig.contactEmail}
              </a>
            </div>
          </Reveal>
        </div>

        {/* Right — form */}
        <div>
          <Reveal delay={100}>
            <div className="max-w-xl">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </div>
    </PageContainer>
  )
}
