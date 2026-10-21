# Marketing site (ValeForge Capital)

**In one sentence:** the public website of ValeForge, an early-stage U.S. real estate investment
company, built for credibility with operators, property owners, financing and capital partners.
It is **not** a fundraising site.

| | |
|---|---|
| Status | Live |
| Users | The public. No accounts |
| Code | Repository root: `src/`, `public/` |
| URL / routes | `https://valeforgecapital.com`: `/`, `/approach`, `/strategies`, `/about`, `/contact`, `/legal/[slug]`, `/api/contact`; `/apps/*` is forwarded to the internal app |
| Runs on | Vercel project `investor-site`, auto-deploys on push to `main` |
| Data | None stored. Contact-form submissions are emailed through Resend |
| Owner rules | Root [CLAUDE.md](../../CLAUDE.md) |

## What it does

- Presents ValeForge: philosophy ("We don't buy properties. We buy opportunities."), approach,
  strategy toolkit, the active market, and how to partner.
- Collects inquiries on `/contact`. The inquiry type routes the email: Property Opportunity and
  Operating Partnership go to `deals@`; Capital Partnership, Financing and General Inquiry go to
  `investment@`. `/contact?intent=property` (the "Submit a Deal" button) preselects Property
  Opportunity.
- Shows the legal pages (Privacy, Terms, Disclaimer) and a non-solicitation line in the footer.

## How it works

- Next.js 15 App Router, server-rendered pages. All copy is in code: `src/lib/content.ts` (page copy),
  `src/lib/site-config.ts` (brand, nav, emails, URL), `src/lib/market.ts` (active market copy and
  photos), `src/lib/legal.ts` (legal texts).
- Contact form: `src/components/contact/ContactForm.tsx` → `POST /api/contact` → validated with the
  shared Zod schema `src/lib/contact-schema.ts` (with a honeypot field) → Resend.
- Theme: dark by default, light variant via `prefers-color-scheme` and a header toggle. Tokens in
  `src/app/globals.css`, documented in [design-system.md](../design-system.md).

## Code map

```
src/app/                 routes, layout, icon, robots, sitemap, api/contact, legal/[slug]
src/components/sections/ Hero, Philosophy, Strategies, Market, PartnershipCta (+ ClosingCta)
src/components/layout/   Header (nav, mobile drawer, Submit a Deal), Footer
src/components/contact/  ContactForm
src/components/ui/       Section, TextSection, PageHeader, ButtonLink, Logo, Reveal, ThemeToggle…
src/lib/                 content, site-config, market, legal, contact-schema
public/brand/            official logo kit
next.config.ts           the /apps rewrite to the internal app
```

## Data

None. No database, no CMS. Email delivery needs two Vercel variables: `RESEND_API_KEY` and
`CONTACT_FROM_EMAIL` (a sender on a domain verified in Resend).

## Connections

| Direction | Other app | Contract | Defined in | Tested by |
|---|---|---|---|---|
| Forwards to | ValeForge internal app | `/apps` and `/apps/*` are rewritten to the internal app's deployment (default: the Railway URL; `ANALYZER_URL` overrides, `off` disables). The path `/apps` must equal the app's `ANALYZER_BASE_PATH` | `next.config.ts` (`analyzerRewrites`, `ANALYZER_BASE_PATH`) | `src/lib/analyzer-route.test.ts` |
| Sends to | Resend (email service) | `/api/contact` sends the inquiry to `deals@` or `investment@` | `src/app/api/contact/route.ts`, `src/lib/contact-schema.ts` | route tests |

The site never links to `/apps` and never imports internal-app code.

## Rules and decisions

- **No fabricated track record, ever**: no deal counts, AUM, returns, testimonials, logos or case
  studies. `src/app/page.test.tsx` guards the home page.
- No "invest with us" language and no securities solicitation.
- The brand is **ValeForge** in copy; **ValeForge Capital** only for the legal entity.
- Each topic lives on exactly one page (`src/app/no-duplicate-sections.test.tsx`). Explain ideas in
  text, not diagrams or widgets (owner decision).
- Photos illustrate the market only, never presented as ValeForge properties.
- Next.js is pinned exactly (security). See root CLAUDE.md → "Known gotchas".

## Run, test, deploy

```bash
npm install && npm run dev   # http://localhost:3000
npm test                     # vitest + Testing Library + jest-axe (a11y on every page)
npm run lint && npm run build
```

Merging to `main` deploys to production on Vercel.

## Status and known gaps

Root [CLAUDE.md](../../CLAUDE.md) → "Before launch" lists the placeholders and the items waiting for
counsel review (legal texts, non-solicitation line).

## Read next

Root [CLAUDE.md](../../CLAUDE.md), [README.md](../../README.md), [design-system.md](../design-system.md).
