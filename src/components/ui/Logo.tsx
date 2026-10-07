import Image from 'next/image'
import { siteConfig } from '@/lib/site-config'

// Official brand kit (public/brand). The horizontal lockups are cropped to
// their content; "for-dark" has white lettering, "for-light" navy lettering.
const LOGO_WIDTH = 1957
const LOGO_HEIGHT = 390

/**
 * The Vale Forge Capital horizontal logo. Renders both colourways and lets
 * CSS (`.logo-for-dark` / `.logo-for-light` in globals.css) show the one that
 * matches the active theme, so there is no flash or hydration mismatch.
 */
export function Logo({ className = 'h-9', priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className="inline-flex items-center">
      <Image
        src="/brand/logo-horizontal-for-dark.png"
        alt={siteConfig.name}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        className={`logo-for-dark w-auto ${className}`}
      />
      <Image
        src="/brand/logo-horizontal-for-light.png"
        alt={siteConfig.name}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        className={`logo-for-light w-auto ${className}`}
      />
    </span>
  )
}

/**
 * The brand's pillar icon as inline SVG (traced from the kit), for decorative
 * use at any size. Inherits the brand-gold token via `fill-primary`.
 */
export function BrandIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="200 240 680 600" aria-hidden="true" focusable="false" className={`fill-primary ${className}`}>
      <path d="M540 247L875 393H205z" />
      <rect x="268" y="435" width="83" height="313" />
      <rect x="414" y="435" width="84" height="313" />
      <rect x="582" y="435" width="83" height="313" />
      <rect x="728" y="435" width="83" height="313" />
      <rect x="205" y="791" width="670" height="41" />
    </svg>
  )
}
