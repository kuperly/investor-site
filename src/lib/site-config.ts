/**
 * Single source of truth for site-wide, brand-dependent content.
 * `name` drives the logo lockup too (see `Logo.tsx`). Nothing else in the
 * codebase should hardcode it. Page copy lives in `content.ts`.
 */
export const siteConfig = {
  name: 'Vale Forge Capital',
  tagline: 'Building Value from Opportunity.',
  philosophy: "We don't buy properties. We buy opportunities.",
  description:
    'Vale Forge Capital is a U.S. real estate investment company focused on acquiring, improving and operating opportunities where disciplined execution can create meaningful equity and recurring cash flow.',
  // Placeholder — swap for the real inbox before launch.
  contactEmail: 'hello@example.com',
  /** Canonical origin for metadata/OG/sitemap. Override with NEXT_PUBLIC_SITE_URL. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://valeforgecapital.com',
  /**
   * Primary navigation. A future public-safe "Investment Platform" entry
   * slots in here (before Contact) — don't add it until there's a public
   * version to link to.
   */
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Approach', href: '/approach' },
    { label: 'Strategies', href: '/strategies' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  /** Legal pages are placeholders until counsel provides the documents. */
  legal: [
    { label: 'Privacy', href: '/legal/privacy' },
    { label: 'Terms', href: '/legal/terms' },
    { label: 'Disclaimer', href: '/legal/disclaimer' },
  ],
} as const

export type NavItem = (typeof siteConfig.nav)[number]
