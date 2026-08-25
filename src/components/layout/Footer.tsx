import { siteConfig } from '@/lib/site-config'
import { Logo } from '@/components/ui/Logo'
import { pageGutter } from '@/components/ui/PageContainer'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className={`py-10 ${pageGutter}`}>
        <div>
          <Logo className="text-lg" />
          <p className="mt-1 text-muted-foreground">{siteConfig.marketFocus}</p>
        </div>

        <div className="mt-8 space-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            © <span className="tabular-nums">{year}</span> {siteConfig.name}. All rights reserved.
          </p>
          {/* PLACEHOLDER legal disclaimer — standard boilerplate; have counsel review before launch. */}
          <p className="max-w-3xl">
            For informational purposes only. Nothing on this website constitutes an offer to sell or a
            solicitation of an offer to buy any security, or investment, legal, or tax advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
