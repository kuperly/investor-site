import { siteConfig } from '@/lib/site-config'

/**
 * The G&B Capital wordmark — Space Grotesk (brand font) with the ampersand
 * in brass. Derived from `siteConfig.name` so the brand stays single-sourced;
 * the "&" is tinted automatically when the name contains one.
 */
export function Logo({ className = '' }: { className?: string }) {
  const [head, ...rest] = siteConfig.name.split('&')
  const tail = rest.join('&')

  return (
    <span className={`font-brand font-semibold tracking-tight text-foreground ${className}`}>
      {rest.length > 0 ? (
        <>
          {head}
          <span className="text-primary">&amp;</span>
          {tail}
        </>
      ) : (
        siteConfig.name
      )}
    </span>
  )
}
