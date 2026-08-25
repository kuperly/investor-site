import { siteConfig } from '@/lib/site-config'
import { Logo } from '@/components/ui/Logo'
import { pageGutter } from '@/components/ui/PageContainer'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className={`py-10 ${pageGutter}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Logo className="text-lg" />
            <p className="mt-1 text-muted-foreground">{siteConfig.marketFocus}</p>
          </div>

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
