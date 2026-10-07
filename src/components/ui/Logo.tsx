import { siteConfig } from '@/lib/site-config'

/**
 * The ValeForge "Vale Spark" mark: two brass blades folding into a V — the
 * vale — with a diamond spark struck in the hollow — the forge. Decorative;
 * the wordmark beside it carries the accessible name.
 */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <path d="M3 5h6.2L16 19.4V27z" className="fill-primary" />
      <path d="M29 5h-6.2L16 19.4V27z" className="fill-primary" opacity="0.62" />
      <path d="M16 7.6l2.6 2.6L16 12.8l-2.6-2.6z" className="fill-foreground" />
    </svg>
  )
}

/**
 * The ValeForge lockup — mark + Space Grotesk wordmark. Derived from
 * `siteConfig.name` so the brand stays single-sourced: the first word is the
 * wordmark (a camel-cased second half, e.g. "Forge", is tinted brass) and any
 * remaining words would become a small tracked descriptor.
 */
export function Logo({ className = '' }: { className?: string }) {
  const [word, ...rest] = siteConfig.name.split(' ')
  const descriptor = rest.join(' ')
  const camel = word.match(/^(.+?)([A-Z].*)$/)

  return (
    <span className={`inline-flex items-center gap-2 font-brand text-foreground ${className}`}>
      <LogoMark className="h-[1.35em] w-[1.35em] shrink-0" />
      <span className="font-semibold tracking-tight">
        {camel ? (
          <>
            {camel[1]}
            <span className="text-primary">{camel[2]}</span>
          </>
        ) : (
          word
        )}
      </span>
      {descriptor && (
        <>
          {' '}
          <span className="text-[0.6em] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {descriptor}
          </span>
        </>
      )}
    </span>
  )
}
