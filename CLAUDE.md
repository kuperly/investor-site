# Larkspur Capital Partners — Investor Site

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
`src/app/a11y.test.tsx` runs jest-axe against all four pages as a WCAG
regression guard — extend it if new pages are added. Global constraints
(no fabricated claims, no stock photos, ≥44px touch targets, ≥4.5:1
contrast) are enforced by convention and code review, not by automated
tests beyond axe's structural checks.
