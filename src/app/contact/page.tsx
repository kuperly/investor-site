import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/ContactForm'
import { siteConfig } from '@/lib/site-config'
import { Reveal } from '@/components/ui/Reveal'
import { HeroBackground } from '@/components/ui/HeroBackground'

export const metadata: Metadata = {
  title: 'Contact',
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6">
      <div className="relative overflow-hidden pt-20">
        <HeroBackground />
        <Reveal>
          <p className="font-body text-sm uppercase tracking-wide text-primary">Contact</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold text-foreground">Let&apos;s talk</h1>
          <p className="mt-6 text-lg text-muted-foreground">
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
