# G&B Capital — Investor Site

> **Repo-wide rule: docs are always kept current.** Every change updates the
> documentation it affects **in the same commit**. Add what's new, update
> what changed, and remove what's no longer true. This covers this file, the
> READMEs, `docs/`, `deal-analyzer/CLAUDE.md`, and the skills in
> `.claude/skills/`. A change with stale docs is not done. (Analyzer-specific
> checklist: `deal-analyzer/CLAUDE.md` → "Documentation is part of every
> change".)

A 4-page Next.js marketing site for a pre-launch real estate investment
company, built for credibility with investors and real estate professionals
(not active fundraising). Visual system and its rationale:
[docs/design-system.md](docs/design-system.md).

## Before launch — placeholder values to swap

Everything below is a deliberate placeholder, documented so it's a one-line
change rather than a hunt through the codebase:

- **Company name/copy**: `src/lib/site-config.ts` — `siteConfig.name`,
  `tagline`, `description`, `marketFocus`, `contactEmail`. This is the single
  source of truth; nothing else in the app hardcodes the brand name.
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

- `src/app/` — routes: `/` (home), `/approach`, `/about`, `/contact`,
  `/api/contact` (route handler)
- `src/components/layout/` — `Header.tsx` (sticky nav, active-page
  indicator, mobile drawer), `Footer.tsx`
- `src/components/contact/` — `ContactForm.tsx` (client component, intent
  selector + inline validation + submit states)
- `src/components/ui/` — presentational primitives: `Eyebrow.tsx` (tracked
  label + gold rule, used on every page masthead), `HeroBackground.tsx`
  (decorative skyline + appreciation trendline, client component for
  parallax/draw-in), `Reveal.tsx` (IntersectionObserver scroll reveal)
- `src/lib/site-config.ts` — brand config (see above)
- `src/lib/contact-schema.ts` — Zod schema shared by the form and the API
  route (includes an empty-only `honeypot` field for spam deterrence)

## Design tokens

Institutional **champagne-brass-on-deep-ink** dark theme by default, with a
warm-paper/dark-bronze light variant driven by `prefers-color-scheme` (no
toggle — see `src/app/globals.css` CSS custom properties, mapped into
Tailwind via `tailwind.config.ts`). Every foreground/background pair meets
≥4.5:1 in both modes. Typography: EB Garamond (headings, weights 400–700 +
italic) + Source Sans 3 (body), loaded via `next/font/google` in
`src/app/layout.tsx`. No stock photography anywhere by design — the site is
**typography-led** (deliberately reaffirmed; a listings-style photo direction
was considered and rejected as off-brief for an investment firm).

Full visual system — palette, type scale, motion, components, and the
reasoning behind them — lives in
[docs/design-system.md](docs/design-system.md). Motion (hero trendline
draw-in, subtle scroll parallax in `HeroBackground.tsx`, spring-eased scroll
reveals in `Reveal.tsx`) is intentionally restrained and always collapses to
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
deploy. See [deal-analyzer/README.md](deal-analyzer/README.md) and its own
[deal-analyzer/CLAUDE.md](deal-analyzer/CLAUDE.md). Business rules live only
in `deal-analyzer/src/engine/` (deals), `deal-analyzer/src/market/engine/`
(markets) and `deal-analyzer/src/sourcing/engine/` (gates, buy-box screen);
thresholds there change only with Guy/Ben approval.

**Hidden route.** `next.config.ts` (`analyzerRewrites`) forwards
`<ANALYZER_BASE_PATH>/*` (e.g. `/vf-internal`) to the analyzer's own
deployment at `ANALYZER_URL` (Railway project `valeforge-deal-analyzer`). It's inert unless both env vars are set, and
tested in `src/lib/analyzer-route.test.ts`. Access control is the analyzer's
own sign-in, not this site. Setup steps: deal-analyzer/README.md →
"Deploying". Remove the rewrite when the analyzer moves to its own repo.

Project skills for the analyzer live in `.claude/skills/`: `vf-qa`,
`vf-security`, `vf-underwriting-analyst`, `vf-real-estate-investor` and
`vf-property-inspector`.

## Testing

TDD throughout: every component/page/route has a co-located `*.test.tsx`.
`src/app/a11y.test.tsx` runs jest-axe against all four pages as a WCAG
regression guard — extend it if new pages are added. Global constraints
(no fabricated claims, no stock photos, ≥44px touch targets, ≥4.5:1
contrast) are enforced by convention and code review, not by automated
tests beyond axe's structural checks.
