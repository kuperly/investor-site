/**
 * Single source of truth for site-wide, brand-dependent content.
 * `name` is a placeholder — swap it here when the real company name
 * is finalized. Nothing else in the codebase should hardcode it.
 */
export const siteConfig = {
  name: 'G&B Capital',
  tagline: 'Disciplined real estate investment.',
  description:
    'G&B Capital acquires and manages real estate for long-term capital appreciation, with a select number of disciplined renovation projects.',
  marketFocus: 'Texas and select U.S. markets',
  contactEmail: 'hello@example.com',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Approach', href: '/approach' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
} as const

export type NavItem = (typeof siteConfig.nav)[number]
