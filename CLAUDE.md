# ValeForge — Marketing Site

> **This repo holds more than one app.** Start with the app registry,
> [docs/apps/README.md](docs/apps/README.md): every app, what it does, how the
> apps connect, and which doc to read for your task. This file covers the
> marketing site; the internal app has its own `deal-analyzer/CLAUDE.md`.
> Adding, removing or reconnecting an app updates the registry and the app's
> page in `docs/apps/` (template: `docs/apps/_template.md`).

> **Repo-wide rule: docs are always kept current.** Every change updates the
> documentation it affects **in the same commit**. Add what's new, update
> what changed, and remove what's no longer true. This covers this file, the
> READMEs, `docs/` (including the app registry `docs/apps/`), `AGENTS.md`,
> `deal-analyzer/CLAUDE.md`, `deal-analyzer/docs/modules/`, and the skills in
> `.claude/skills/`. A change with stale docs is not done. (Analyzer-specific
> checklist: `deal-analyzer/CLAUDE.md` → "Documentation is part of every
> change".)

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
  (`src/app/legal/[slug]/page.tsx`) render generic texts from
  `src/lib/legal.ts` that describe only what the site actually does (contact
  form by email, hosting logs, theme preference in localStorage, no tracking
  cookies). They stay `noindex` until counsel has reviewed them; then drop it.
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
  `Market`, `PartnershipCta` (+ `ClosingCta`). Other content
  (model, underwriting, capital efficiency, exit paths) uses the plain
  `TextSection` primitive.
- **Each topic lives on exactly one page** (owner feedback: inner pages
  must not repeat Home). Home = hero (one CTA), philosophy + misalignment,
  market, full partnership section — kept deliberately short, and no line
  (tagline, philosophy, market) repeats between Home and the footer. Approach = model, four steps, underwriting, capital efficiency,
  exit paths. Strategies = the toolkit list. About = Built to Compound +
  How We Invest. Inner pages end with the one-line `ClosingCta`.
  `src/app/no-duplicate-sections.test.tsx` fails if an h1/h2 repeats
  across pages.
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
  globals.css — + `BrandIcon`, the pillar icon as SVG), `Reveal.tsx`, `ThemeToggle.tsx`
- `src/lib/content.ts` — all marketing copy (single-sourced, tested)
- `src/lib/market.ts` — active market (DFW) copy + Unsplash photos
- `src/lib/site-config.ts` — brand config (see above)
- `src/lib/contact-schema.ts` — Zod schema shared by the form and the API
  route (includes an empty-only `honeypot` field for spam deterrence)

## Design tokens

Institutional **champagne-brass-on-deep-ink-navy** dark theme by default
(owner-approved — keep it), with a warm-paper/dark-bronze light variant, driven by `prefers-color-scheme`
and overridable via the header `ThemeToggle` (see `src/app/globals.css`
CSS custom properties, mapped into Tailwind via `tailwind.config.ts`).
Every foreground/background pair meets ≥4.5:1 in both modes. Typography:
Fraunces (headings) + Source Sans 3 (body), loaded via `next/font/google` in `src/app/layout.tsx`.

**Photography (owner-approved):** a few Unsplash photos of the active market
(free Unsplash License; credited on the page), configured in
`src/lib/market.ts` — hero (full-bleed under a navy overlay, `.on-photo`
pins the dark palette so text stays legible in both themes), Philosophy
(residential) and the Market section. Photos illustrate the market only:
**never** present stock or AI images as ValeForge properties, projects or
before/after renovations.

**Market focus:** currently Dallas–Fort Worth (may switch to Indianapolis).
Everything market-specific — name, copy, photos — lives in
`src/lib/market.ts`; switching is adding an entry + photos under
`public/images/markets/<key>/` and changing `activeMarket`.

**Submit a Deal:** header button (lg+) and mobile drawer link to
`/contact?intent=property`, which preselects Property Opportunity (routes
to `deals@`).

Full visual system — palette, type scale, motion, components, and the
reasoning behind them — lives in
[docs/design-system.md](docs/design-system.md). Motion (CSS entrance on hero/mastheads,
page fade-in via `src/app/template.tsx`, scroll reveals in `Reveal.tsx` — hidden only under `html.js`, slow photo zoom on hover, quiet hovers) is intentionally restrained and always collapses to
its final frame under `prefers-reduced-motion`.

## Known gotchas

- **`.npmrc` (`legacy-peer-deps=true`) is required.** `@testing-library/react`
  declares a React 18 peer dependency; the project runs React 19. Without
  this file, a clean `npm install` (e.g. on Vercel) fails with `ERESOLVE`.
  Do not remove it without also resolving the underlying peer conflict.
- **Next.js version is security-pinned, exactly.** Currently `15.5.27`
  (`next` and `eslint-config-next`, no `^`). The previous pin, 15.1.11, had
  an npm audit "critical" rating, including middleware-bypass and
  rewrite-smuggling advisories. Check https://nextjs.org/blog and
  `npm audit --omit=dev` before bumping. Verify a bump with tests, lint,
  build, and before/after screenshots of all four pages (desktop + mobile,
  dark + light). The 15.5.27 upgrade was pixel-identical.
- **Accepted audit findings** (build-time or internal input only, re-check
  on each bump): the `postcss` bundled inside Next (processes only our CSS
  at build time), and `brace-expansion` via `resend` → `js-beautify`
  (formats our own email templates, never visitor input).
- **`next lint` is deprecated** (it prints a notice, still works on 15.x).
  Migrate to the ESLint CLI before Next 16
  (`npx @next/codemod@canary next-lint-to-eslint-cli .`).
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

## ValeForge internal app (`deal-analyzer/`)

A separate internal Next.js app (own `package.json`, tests, and README) with three
modules behind one login, working as one chain of layers
(`deal-analyzer/docs/LAYERS.md`): Market Intelligence (VF-03, `src/market/`,
`/markets`) → Deal Sourcing (`src/sourcing/`, `/sourcing`) → Deal Analyzer
(`src/engine/`, `/`). It is excluded from this site's `tsconfig.json`
and `vitest.config.ts`, so it never affects the marketing site's build or
deploy. See [docs/apps/valeforge-internal-app.md](docs/apps/valeforge-internal-app.md)
(overview, connections; one page per module in `deal-analyzer/docs/modules/`),
[deal-analyzer/README.md](deal-analyzer/README.md) and its own
[deal-analyzer/CLAUDE.md](deal-analyzer/CLAUDE.md). Business rules live only
in `deal-analyzer/src/engine/` (deals), `deal-analyzer/src/market/engine/`
(markets) and `deal-analyzer/src/sourcing/engine/` (gates, buy-box screen);
thresholds there change only with Guy/Ben approval.

**Hidden route.** `next.config.ts` (`analyzerRewrites`) forwards `/apps/*`
to the analyzer's own deployment (Railway project `valeforge-deal-analyzer`).
The path is a constant in code (`ANALYZER_BASE_PATH = '/apps'`, must equal the
analyzer's own build-time `ANALYZER_BASE_PATH`) and the target defaults to the
Railway URL, so no Vercel variable is needed. Optional env `ANALYZER_URL`
overrides the target (`off` disables the route). Tested in
`src/lib/analyzer-route.test.ts`. Access control is the analyzer's
own sign-in, not this site. Setup steps: deal-analyzer/README.md →
"Deploying". Remove the rewrite when the analyzer moves to its own repo.

Project skills for the analyzer live in `.claude/skills/`: `vf-qa`,
`vf-security`, `vf-underwriting-analyst`, `vf-real-estate-investor` and
`vf-property-inspector`.

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
