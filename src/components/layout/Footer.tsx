import { siteConfig } from '@/lib/site-config'
import { Logo } from '@/components/ui/Logo'
import { pageGutter } from '@/components/ui/PageContainer'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className={`py-8 ${pageGutter}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Logo className="text-lg" />
            <span aria-hidden="true" className="hidden text-muted-foreground sm:inline">
              ·
            </span>
            <span className="text-sm text-muted-foreground">{siteConfig.marketFocus}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © <span className="tabular-nums">{year}</span> {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
