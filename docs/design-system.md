# Design system — ValeForge

The visual language of the site and the reasoning behind it. The site's job
is to make a visitor think *"these people approach real estate like an
investment business"* — not *"these people flip houses."* Every decision
below serves that.

## Direction

A boutique real estate investment / development firm: **muted brass on warm
charcoal**, editorial typography, architectural linework, large margins.
Not a realtor site, not a guru site, not a SaaS landing page.

- **Typography-led.** No stock photography. The only imagery is
  architectural SVG linework (the hero elevation) and abstract conceptual
  glyphs. Generic stock photos read as less serious for an investment firm;
  owned or properly licensed architectural photography could be added later.
- **No fake proof.** No charts with values, no metrics, no testimonials, no
  logos. Diagrams are conceptual (the model loop, the exit-path tree) and say
  so where it matters.
- **Restraint over cards.** Sections are separated by hairline rules and a
  subtle tonal band (`Section tone="muted"`), not by card grids with shadows.
  Lists are ruled indexes with small index numbers.

## Color

Semantic tokens only — defined once in `src/app/globals.css` as
space-separated RGB channels (for Tailwind `<alpha-value>` support) and
consumed via the Tailwind color names in `tailwind.config.ts`. Never hardcode
hex in components (the OG image and favicon are the only exceptions, since
they render outside the page CSS).

| Token | Dark (default) | Light |
|---|---|---|
| `background` | `#121110` warm near-black | `#F6F3EC` warm paper |
| `foreground` | `#F2EEE6` warm off-white | `#171614` charcoal |
| `primary` | `#C4A46A` muted brass | `#7A5F24` dark bronze |
| `secondary` | `#D6BE92` lighter brass (hover) | `#624C1C` |
| `card` | `#1A1917` | `#FBF9F4` |
| `muted` / `muted-foreground` | `#23211E` / `#A9A296` stone | `#ECE7DC` sand / `#5C564C` stone |
| `border` | `#34312C` | `#DED7C9` |
| `ring` | brass | bronze |

Measured contrast: foreground ≥13.8:1, muted-foreground ≥5.9:1, primary
≥4.9:1 on every surface in both modes; button text on brass ≥6:1. No blue,
no green, no gradients beyond a faint brass wash in the hero.

## Typography

- **Headings:** Fraunces (`font-heading`), weight ~400–500 — editorial, not
  heavy. Display sizes use `.tracking-display` (−0.02em) and `.text-balance`.
  Italic + brass is reserved for the second line of the philosophy statement.
- **Body:** Source Sans 3, 400–600.
- **Logo wordmark only:** Space Grotesk (`font-brand`).
- **Eyebrows:** the `Eyebrow` component — 12px, `.tracking-eyebrow` (0.22em),
  uppercase, brass, preceded by a 32px brass rule.
- Scale: hero h1 up to `text-8xl`; philosophy up to 6.5rem; page h1 up to
  `text-7xl`; section h2 `text-5xl`; item h3 `text-2xl`–`3xl`.

## Motion

Expensive, not flashy. Every animation collapses to its final frame under
`prefers-reduced-motion` (the global rule zeroes duration *and* delay).

- **Hero linework draw-in** — building outlines stroke in (`.draw-line`,
  `.draw-line-group`, `pathLength="1"`), facade detail and dimension lines
  fade up after (`.draw-fade`).
- **Hero parallax** — `HeroBackground` drifts on scroll, rAF-throttled and
  capped.
- **Scroll reveals** — `Reveal` fades/rises blocks with
  `cubic-bezier(0.16, 1, 0.3, 1)`, staggered 60–90ms.
- **Hover** — quiet: a brass hairline fills (capabilities), a title nudges
  and turns brass (strategies), CTA arrows slide 4px.

## Layout primitives

- `PageContainer` / `pageGutter` — the one full-width wrapper with the shared
  gutter; header, footer and every section use it, so everything shares one
  left edge.
- `Section` — one section band: top hairline, `py-20/28/32` rhythm, optional
  `tone="muted"` surface, `aria-labelledby` its heading.
- `SectionHeading` — eyebrow → h2 → optional lead at one fixed scale.
- `PageHeader` — the masthead for inner pages (eyebrow → h1 → intro).
- 12-column asymmetric grids (`lg:col-span-5` / `lg:col-start-7`) for
  heading-left / content-right compositions.

## Components

- `Logo` / `LogoMark` — the "Vale Spark" mark (two brass blades folding into
  a V — the vale — with a diamond spark in the hollow — the forge) +
  "Vale**Forge**" wordmark, derived from `siteConfig.name`. Favicon
  (`src/app/icon.svg`) and OG image use the same mark.
- `ButtonLink` / `buttonClasses` / `TextLink` — the two CTA styles (solid
  brass, outlined) with a sliding arrow; square-ish `rounded-sm` corners.
- `ThemeToggle` — light/dark switch (sets `data-theme`, persists, no flash).
- Sections (`src/components/sections/`): `Hero`, `Philosophy`,
  `ValeForgeModel`, `Capabilities`, `Strategies` (`withHeading` prop),
  `CapitalEfficiency`, `Underwriting`, `ExitPaths`, `AboutIntro`,
  `PartnershipCta`.

## Accessibility guardrails

Unified `:focus-visible` ring (2px brass, 2px offset); skip link; one h1 per
page and no skipped heading levels; decorative numbers/glyphs/linework are
`aria-hidden`; active nav `aria-current="page"`; ≥44px touch targets;
`color-scheme` set per theme so native form controls match;
`prefers-reduced-motion` respected. `src/app/a11y.test.tsx` runs jest-axe on
every page plus header/footer — extend it when adding pages.

## When extending

Build pages from `PageHeader` + sections; build sections from `Section` +
`SectionHeading`. Put copy in `src/lib/content.ts`. Reuse the tokens; do not
introduce hardcoded colours, emoji icons, stock photography, card-grid
patterns, or anything that implies a track record that doesn't exist.
