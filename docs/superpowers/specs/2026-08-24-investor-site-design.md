# Design Spec: Real Estate Investment Firm Website

Date: 2026-08-24
Status: Approved by user, ready for implementation planning

## Context

The founder is starting a real estate investment company (primary strategy:
buy-and-hold for capital appreciation, secondary: fix-and-flip). The company
is pre-launch: no legal entity name finalized, no completed deals, no team
beyond the founder. The goal is a website that establishes credibility and
brand presence with two audiences — prospective investors and real estate
professionals (agents/brokers/wholesalers who could bring deals) — **not**
an active capital raise or lead-gen funnel. Likely market focus is Texas,
but not committed; keep geography flexible/expandable.

Research finding (see below) confirms a "thesis-forward" site structure is
the standard approach for emerging managers without a track record: lead
with investment philosophy and how the firm evaluates deals, rather than a
portfolio/deal showcase it doesn't have yet.

Sources consulted:
- https://www.dariengroup.com/insights/real-estate-website-structures
- https://mvpdesign.com/blog/2026s-top-ten-trends-in-private-equity-and-ma-website-design/

## Placeholder Naming

No company name has been decided. The site uses **"Larkspur Capital
Partners"** as a clearly-marked placeholder throughout copy, metadata, and
branding. This must be:
- Defined once as a single source of truth (e.g. a `site.config.ts`
  constant / content field), not hardcoded per-page, so swapping in the
  real name later is a one-line change.
- Never presented as if factual (no fabricated years-in-business, deal
  count, or AUM figures tied to the placeholder).

## Site Architecture

Four pages (Next.js App Router routes), thesis-forward structure:

1. **`/` (Home)** — hero statement + one-line thesis, three "what we do"
   pillars (buy-and-hold appreciation, disciplined flips, [market] focus),
   short credibility strip (not fabricated claims — framed as principles/
   discipline, e.g. "how we evaluate every deal"), CTAs into `/approach`
   and `/contact`.
2. **`/approach`** — the investment thesis in depth: what the firm looks
   for in a deal, evaluation criteria, how buy-and-hold vs. flip decisions
   get made, risk discipline. This page carries the most credibility
   weight in the absence of a deal history.
3. **`/about`** — founder note framed around vision and discipline (not a
   fabricated resume — founder background was not specified, so copy
   stays honest and forward-looking), why the firm exists now, market
   focus (Texas / select U.S. markets, framed as expandable, not fixed).
4. **`/contact`** — single form with an intent selector: "I'm an
   investor" vs. "I have a deal or listing" — serves both target
   audiences without adding more pages. Submission target: a simple
   serverless form handler (e.g. Vercel-compatible email relay or a
   basic API route) — exact provider decided at implementation time,
   no third-party form SaaS unless the user prefers one.

Shared layout: persistent header (logo/wordmark + nav + primary CTA) and
footer (contact info placeholder, nav links, copyright) across all pages.

## Visual Design System

Derived from `ui-ux-pro-max` skill searches for finance/institutional
real-estate-capital positioning (not consumer real-estate/listings style).

**Colors** (dark, institutional navy + gold):
| Role | Hex |
|------|-----|
| Background | `#0F172A` |
| Foreground | `#F8FAFC` |
| Primary/Accent (CTA, emphasis) | `#F59E0B` |
| Secondary accent | `#FBBF24` |
| Card surface | `#222735` |
| Muted surface | `#272F42` |
| Muted foreground | `#94A3B8` |
| Border | `#334155` |
| Destructive (form errors) | `#EF4444` |

Light-mode variant required (see UX checklist) — same hue relationships,
navy becomes the text/accent-on-white color rather than the background.

**Typography:**
- Heading: EB Garamond (serif) — gives institutional gravitas
- Body: Lato (sans) — clean readability
- Base body size 16px, type scale roughly 12/14/16/18/24/32/48px+ for
  hero headlines.

**Imagery:** No stock real-estate photography (house listings, generic
handshake photos). Use abstract/architectural line treatments, subtle
gradients/texture, and typography-led hero sections instead — avoids the
credibility gap of using photos unconnected to actual properties.

**Feel:** Generous whitespace, restrained motion (150–300ms
transitions), no gimmick animations. Matches minimalist, jargon-free
2025–2026 PE/RE site trends found in research.

## Accessibility & UX Baseline

Per the loaded `ui-ux-pro-max` skill's Quick Reference, apply at minimum:
- 4.5:1 text contrast in both light and dark mode (verify navy/gold pairs
  specifically — gold-on-navy CTA text must be checked, not assumed)
- Visible focus states on all interactive elements
- Mobile-first responsive layout, no horizontal scroll, tested at
  375 / 768 / 1024 / 1440px
- Touch targets ≥44×44px
- `prefers-reduced-motion` respected
- Semantic HTML, proper heading hierarchy, labeled form fields with
  inline error messages (not placeholder-only labels)
- SVG icons only (no emoji as icons)

## Tech Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Deployed to Vercel
- No CMS — content lives in code/config for this phase (four static
  pages, low content-churn expectation pre-launch)
- No analytics/tracking decided yet — out of scope for this spec

## Out of Scope (this phase)

- Investor portal / login / deal data room
- Property/deal portfolio gallery (no completed deals yet)
- Team page beyond the founder
- CMS or blog/content marketing system
- Multi-language support
- Fabricated track record, AUM, or team-size claims of any kind

## Open Items for Implementation Planning

- Exact contact-form backend (API route + email relay vs. a lightweight
  form service) — decide during planning, keep provider-agnostic in this
  spec
- Final real company name — placeholder swap is a documented one-line
  change, not a blocker to building
