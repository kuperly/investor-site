import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/ContactForm'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Contact',
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <p className="font-body text-sm uppercase tracking-wide text-primary">Contact</p>
      <h1 className="mt-4 font-heading text-4xl font-semibold text-foreground">Let&apos;s talk</h1>
      <p className="mt-6 text-lg text-muted-foreground">
        Whether you are exploring an investment or have a deal you think fits {siteConfig.name}, tell
        us a bit about it below.
      </p>

      <div className="mt-12">
        <ContactForm />
      </div>
    </div>
  )
}
