import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
              {siteConfig.name}
            </p>
            <p className="mt-1 text-muted-foreground">{siteConfig.marketFocus}</p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground transition-colors duration-200 hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <a
            href={`mailto:${siteConfig.contactEmail}`}
            className="text-muted-foreground transition-colors duration-200 hover:text-primary"
          >
            {siteConfig.contactEmail}
          </a>
        </div>

        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
          © <span className="tabular-nums">{year}</span> {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
