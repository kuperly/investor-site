import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/ContactForm'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow } from '@/components/ui/Eyebrow'

export const metadata: Metadata = {
  title: 'Contact',
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6">
      <div className="pt-20 sm:pt-24">
        <Reveal>
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-6 text-balance font-heading text-4xl font-semibold leading-tight tracking-display text-foreground sm:text-5xl">
            Let&apos;s talk
          </h1>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
            Whether you are exploring an investment or have a deal you think fits {siteConfig.name}, tell
            us a bit about it below.
          </p>
        </Reveal>
      </div>

      <Reveal delay={100}>
        <div className="mt-12 pb-20">
          <ContactForm />
        </div>
      </Reveal>
    </div>
  )
}
