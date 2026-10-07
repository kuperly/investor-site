# ValeForge — Marketing Site

A 5-page Next.js marketing site for ValeForge (ValeForge Capital), an early-stage U.S. real
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

- **Naming**: the brand is **ValeForge** (one word) in all copy and titles;
  **ValeForge Capital** only where the legal entity is meant (copyright,
  logo alt text). Never "Vale Forge". `src/app/page.test.tsx` guards this.
  (The logo artwork itself sets the name as "VALE FORGE / CAPITAL".)
- **Brand config**: `src/lib/site-config.ts` — `name` (ValeForge),
  `legalName` (ValeForge Capital), `url` (defaults to `https://valeforgecapital.com`),
  `tagline`, `philosophy`, `description`, `nav`, `legal`, and `emails`
  (`investment@` and `deals@valeforgecapital.com`, Zoho Mail). Nothing
  else in the app hardcodes the brand name. Page copy lives in
  `src/lib/content.ts`.
- **Site URL**: `siteConfig.url` defaults to `https://valeforgecapital.com`
  (drives canonical URLs, OG, sitemap, robots); override with
  `NEXT_PUBLIC_SITE_URL` if needed.
- **Brand assets**: the official kit lives in `public/brand/` (logos on
  navy/paper, stacked, horizontal, icon, LinkedIn-size banner). The header
  and footer use `logo-horizontal-for-dark.png` / `-for-light.png`
  (cropped; the light one is the dark one with its white lettering recoloured
  to brand navy). Favicon `src/app/icon.svg` is the pillar icon traced as
  vector; `apple-icon.png` and `public/og-image-1200x630.png` (share image,
  declared in `layout.tsx` metadata with its alt text) are generated from the
  kit. Brand colours in the kit: navy `#1D2D3D`, gold `#B08D57`.
- **Legal pages**: `/legal/privacy`, `/legal/terms`, `/legal/disclaimer`
  (`src/app/legal/[slug]/page.tsx`) are honest "being prepared" placeholders
  with `noindex`. Replace with counsel-approved text and drop the noindex.
  The footer's non-solicitation line (`nonSolicitation` in `content.ts`)
  should also get counsel review.
- **Email delivery**: the form routes by inquiry type — Property
  Opportunity / Operating Partnership → `deals@`, Capital Partnership /
  Financing / General Inquiry → `investment@` (`inbox` on
  `contactIntentOptions` in `src/lib/contact-schema.ts`). Two env vars, set
  in Vercel (Project → Settings → Environment Variables), not in code:
  - `RESEND_API_KEY` — from resend.com
  - `CONTACT_FROM_EMAIL` — sender address. **Must be on a domain verified
    in Resend** (e.g. `noreply@valeforgecapital.com`): Resend's test sender
    `onboarding@resend.dev` can only deliver to the Resend account's own
    email, so it can't reach `deals@`/`investment@`.
  - `CONTACT_TO_EMAIL` is no longer read (routing replaced it).

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

- `src/app/` — routes: `/` (home), `/approach`,
  `/strategies`, `/about`, `/contact`, `/legal/[slug]`, `/api/contact`
  (route handler); plus `apple-icon.png`, `icon.svg`,
  `robots.ts`, `sitemap.ts`
- `src/components/sections/` — `Hero`, `Philosophy`, `Strategies`,
  `AboutIntro`, `PartnershipCta`. Other content (model, underwriting,
  capital efficiency, exit paths) uses the plain `TextSection` primitive.
  **Keep the site simple and inviting: explain ideas in text, don't turn
  them into diagrams/flow charts/widgets** (tried and rejected by the owner).
- `src/components/layout/` — `Header.tsx` (sticky nav, active-page
  indicator, mobile drawer below `md`), `Footer.tsx` (brand, nav, legal,
  non-solicitation line)
- `src/components/contact/` — `ContactForm.tsx` (client component, intent
  selector + inline validation + submit states)
- `src/components/ui/` — primitives: `Section.tsx` (`Section` band +
  `SectionHeading`), `TextSection.tsx`, `PageHeader.tsx`, `PageContainer.tsx`, `ButtonLink.tsx`
  (CTA styles + `TextLink`), `Eyebrow.tsx`, `Logo.tsx` (`Logo` — official
  image logo, theme-aware via `.logo-for-dark/.logo-for-light` in
  globals.css — + `BrandIcon`, the pillar icon as SVG), `HeroBackground.tsx` (quiet skyline outline,
  client component for parallax/draw-in), `Reveal.tsx`, `ThemeToggle.tsx`
- `src/lib/content.ts` — all marketing copy (single-sourced, tested)
- `src/lib/site-config.ts` — brand config (see above)
- `src/lib/contact-schema.ts` — Zod schema shared by the form and the API
  route (includes an empty-only `honeypot` field for spam deterrence)

## Design tokens

Institutional **champagne-brass-on-deep-ink-navy** dark theme by default
(owner-approved — keep it), with a warm-paper/dark-bronze light variant, driven by `prefers-color-scheme`
and overridable via the header `ThemeToggle` (see `src/app/globals.css`
CSS custom properties, mapped into Tailwind via `tailwind.config.ts`).
Every foreground/background pair meets ≥4.5:1 in both modes. Typography:
Fraunces (headings) + Source Sans 3 (body), loaded via `next/font/google` in `src/app/layout.tsx`. No stock
photography — the site is **typography-led**, with a quiet skyline
outline behind the hero. If real architectural photography (owned or properly licensed)
becomes available, it can go in the hero behind `HeroBackground`.

Full visual system — palette, type scale, motion, components, and the
reasoning behind them — lives in
[docs/design-system.md](docs/design-system.md). Motion (hero skyline
draw-in, subtle scroll parallax in `HeroBackground.tsx`, spring-eased scroll
reveals in `Reveal.tsx`, quiet hovers) is intentionally restrained and always collapses to
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
