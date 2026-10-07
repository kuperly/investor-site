# ValeForge — Marketing Site

A 5-page Next.js marketing site for ValeForge, an early-stage U.S. real
estate investment company ("Building Value from Opportunity." / "We don't
buy properties. We buy opportunities."). Built for credibility with
operators, property owners, financing and capital partners — **not** active
fundraising: no "invest with us" language, no securities solicitation.
Strategy-agnostic positioning (value-add, fix & flip, BRRRR, buy & hold,
small multifamily, creative financing are a *toolkit*, never claims). Visual system and its rationale:
[docs/design-system.md](docs/design-system.md).

## Before launch — placeholder values to swap

Everything below is a deliberate placeholder, documented so it's a one-line
change rather than a hunt through the codebase:

- **Brand config**: `src/lib/site-config.ts` — `name` (final: ValeForge),
  `tagline`, `philosophy`, `description`, `nav`, `legal`, and
  **`contactEmail` (still `hello@example.com` — placeholder)**. Nothing
  else in the app hardcodes the brand name. Page copy lives in
  `src/lib/content.ts`.
- **Site URL**: set `NEXT_PUBLIC_SITE_URL` in Vercel once a custom domain
  exists (drives canonical URLs, OG, sitemap, robots); otherwise falls back
  to `VERCEL_PROJECT_PRODUCTION_URL`.
- **Legal pages**: `/legal/privacy`, `/legal/terms`, `/legal/disclaimer`
  (`src/app/legal/[slug]/page.tsx`) are honest "being prepared" placeholders
  with `noindex`. Replace with counsel-approved text and drop the noindex.
  The footer's non-solicitation line (`nonSolicitation` in `content.ts`)
  should also get counsel review.
- **Email delivery**: three env vars, set in Vercel (Project → Settings →
  Environment Variables), not in code:
  - `RESEND_API_KEY` — from resend.com
  - `CONTACT_TO_EMAIL` — inbox that receives form submissions
  - `CONTACT_FROM_EMAIL` — sender address (must be `onboarding@resend.dev`
    unless a custom domain is verified in Resend, in which case
    `CONTACT_TO_EMAIL` is unrestricted; the `onboarding@resend.dev` sender
    can only deliver to the email on the Resend account itself)

## Tech stack

Next.js 15 (App Router) + TypeScript + Tailwind CSS. Vitest + React Testing
Library + jest-axe for tests. Resend for contact-form email. No CMS —
content lives in code.

## Commands

```bash
npm run dev      # local dev server
npm test         # full test suite (vitest run)
npm run build    # production build
npm run lint     # eslint
```

## Structure

- `src/app/` — routes: `/` (home — the full long-form story), `/approach`,
  `/strategies`, `/about`, `/contact`, `/legal/[slug]`, `/api/contact`
  (route handler); plus `opengraph-image.tsx`, `robots.ts`, `sitemap.ts`,
  `icon.svg`
- `src/components/sections/` — reusable page sections (`Hero`,
  `Philosophy`, `ValeForgeModel`, `Capabilities`, `Strategies`,
  `CapitalEfficiency`, `Underwriting`, `ExitPaths`, `AboutIntro`,
  `PartnershipCta`). Home composes all of them; inner pages reuse subsets.
- `src/components/layout/` — `Header.tsx` (sticky nav, active-page
  indicator, mobile drawer below `md`), `Footer.tsx` (brand, nav, legal,
  non-solicitation line)
- `src/components/contact/` — `ContactForm.tsx` (client component, intent
  selector + inline validation + submit states)
- `src/components/ui/` — primitives: `Section.tsx` (`Section` band +
  `SectionHeading`), `PageHeader.tsx`, `PageContainer.tsx`, `ButtonLink.tsx`
  (CTA styles + `TextLink`), `Eyebrow.tsx`, `Logo.tsx` (`Logo` +
  `LogoMark`), `HeroBackground.tsx` (architectural elevation linework,
  client component for parallax/draw-in), `Reveal.tsx`, `ThemeToggle.tsx`
- `src/lib/content.ts` — all marketing copy (single-sourced, tested)
- `src/lib/site-config.ts` — brand config (see above)
- `src/lib/contact-schema.ts` — Zod schema shared by the form and the API
  route (includes an empty-only `honeypot` field for spam deterrence)

## Design tokens

Institutional **muted-brass-on-warm-charcoal** dark theme by default, with a
warm-paper/sand/dark-bronze light variant, driven by `prefers-color-scheme`
and overridable via the header `ThemeToggle` (see `src/app/globals.css`
CSS custom properties, mapped into Tailwind via `tailwind.config.ts`).
Every foreground/background pair meets ≥4.5:1 in both modes. Typography:
Fraunces (headings) + Source Sans 3 (body) + Space Grotesk (logo wordmark
only), loaded via `next/font/google` in `src/app/layout.tsx`. No stock
photography — the site is **typography-led** with architectural SVG
linework. If real architectural photography (owned or properly licensed)
becomes available, it can go in the hero behind `HeroBackground`.

Full visual system — palette, type scale, motion, components, and the
reasoning behind them — lives in
[docs/design-system.md](docs/design-system.md). Motion (hero linework
draw-in, subtle scroll parallax in `HeroBackground.tsx`, spring-eased scroll
reveals in `Reveal.tsx`, quiet hover hairlines) is intentionally restrained and always collapses to
its final frame under `prefers-reduced-motion`.

## Known gotchas

- **`.npmrc` (`legacy-peer-deps=true`) is required.** `@testing-library/react`
  declares a React 18 peer dependency; the project runs React 19. Without
  this file, a clean `npm install` (e.g. on Vercel) fails with `ERESOLVE`.
  Do not remove it without also resolving the underlying peer conflict.
- **Next.js version is security-pinned.** Currently `15.1.11`, patching
  CVE-2025-66478 (critical RCE) and CVE-2025-55183/55184/67779. Check
  https://nextjs.org/blog for new advisories before bumping or pinning an
  older version in the 15.1.x line.
- **Git remote uses a custom SSH host alias.** `origin` is
  `git@github-private:kuperly/investor-site.git` — `github-private` is a
  host alias in this machine's SSH config for the `kuperly` GitHub account,
  distinct from `github.com` (which resolves to a different account,
  `guy-kuperly`, on this machine). Don't "simplify" the remote back to
  `git@github.com:...` — it will silently push/pull as the wrong account
  (or fail outright).
- **Vercel project**: `guys-projects-c57d7bcd/investor-site`
  (`prj_4zjmuFVpXvpOdFjPqAaAbKu1wM69`), connected to the `kuperly/investor-site`
  GitHub repo for auto-deploy on push to `main`.

## Testing

TDD throughout: every component/page/route has a co-located `*.test.tsx`.
`src/app/a11y.test.tsx` runs jest-axe against all five pages plus the
header/footer as a WCAG regression guard — extend it if new pages are
added. `src/app/page.test.tsx` also guards against fabricated performance
claims (%, IRR, AUM, testimonials, "passive income"…) on the home page.

**No fabricated track record — ever.** ValeForge is early-stage: no deal
counts, AUM, returns, investor counts, testimonials, logos, case studies or
years-of-experience claims. Other constraints (≥44px touch targets, ≥4.5:1
contrast) are enforced by convention and code review.

A future public-safe "Investment Platform" nav item would slot into
`siteConfig.nav`; don't expose internal deal-analysis tooling here.
