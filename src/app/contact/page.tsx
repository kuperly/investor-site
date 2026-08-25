import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/ContactForm'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

export const metadata: Metadata = {
  title: 'Contact',
}

export default function ContactPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Contact"
        title="Let's talk"
        intro={`Whether you are exploring an investment or have a deal you think fits ${siteConfig.name}, tell us a bit about it below.`}
      />

      <Reveal delay={100}>
        <div className="mt-14 max-w-xl pb-24">
          <ContactForm />
        </div>
      </Reveal>
    </PageContainer>
  )
}
