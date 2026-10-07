import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'
import { nonSolicitation } from '@/lib/content'
import { Logo } from '@/components/ui/Logo'
import { pageGutter } from '@/components/ui/PageContainer'

const linkClass =
  'inline-flex min-h-[44px] items-center text-foreground/80 transition-colors duration-200 hover:text-primary md:min-h-0 md:py-1'

export function Footer() {
  const year = new Date().getFullYear()
  const nav = siteConfig.nav.filter((item) => item.href !== '/')

  return (
    <footer className="border-t border-border bg-background">
      <div className={`pb-10 pt-16 sm:pt-20 ${pageGutter}`}>
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <Logo className="text-2xl" />
            <p className="mt-5 font-heading text-2xl text-foreground">{siteConfig.tagline}</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {siteConfig.philosophy}
            </p>
          </div>

          <nav aria-label="Footer" className="md:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">Company</p>
            <ul className="mt-4 space-y-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal" className="md:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">Legal</p>
            <ul className="mt-4 space-y-1">
              {siteConfig.legal.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-border pt-8 text-sm text-muted-foreground lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <p className="max-w-3xl text-pretty leading-relaxed">{nonSolicitation}</p>
          <p className="shrink-0">
            © <span className="tabular-nums">{year}</span> {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
