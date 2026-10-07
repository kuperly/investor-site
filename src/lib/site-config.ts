/**
 * Single source of truth for site-wide, brand-dependent content.
 * Nothing else in the codebase should hardcode the name. Page copy lives in
 * `content.ts`.
 *
 * Naming: the brand is "ValeForge" (one word) everywhere in copy and titles;
 * the company name "ValeForge Capital" is used only where the legal entity is
 * meant (copyright line, logo alt text).
 */
export const siteConfig = {
  name: 'ValeForge',
  legalName: 'ValeForge Capital',
  tagline: 'Building Value from Opportunity.',
  philosophy: "We don't buy properties. We buy opportunities.",
  description:
    'ValeForge is a U.S. real estate investment company focused on acquiring and creating value from overlooked opportunities, using disciplined underwriting, active execution and thoughtful capital structures.',
  /**
   * Public inboxes (Zoho Mail). The contact form routes each inquiry type to
   * one of these — see `contactIntentOptions` in contact-schema.ts.
   */
  emails: {
    investment: 'investment@valeforgecapital.com',
    deals: 'deals@valeforgecapital.com',
  },
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
