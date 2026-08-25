# Design system — G&B Capital

The visual language of the site and the reasoning behind it. The site's job
is **credibility with investors and deal partners**, not property listings —
every decision below serves that.

## Direction

Institutional **champagne brass on deep ink** — the register of a boutique
capital-partners firm, not a consumer real-estate portal. Typography-led,
with no photography by design: on a listings site photos sell a property; on
a firm's site generic stock imagery reads as less serious, so the site earns
trust through type, restraint, and a single recurring motif (value
compounding upward over time).

## Color

Semantic tokens only — defined once in `src/app/globals.css` as
space-separated RGB channels (for Tailwind `<alpha-value>` support) and
consumed via the Tailwind color names in `tailwind.config.ts`. Never hardcode
hex in components.

| Token | Dark (default) | Light |
|---|---|---|
| `background` | `#0A0F1C` deep ink | `#FAF8F3` warm paper |
| `foreground` | `#F4F2EC` warm paper-white | `#14192B` deep ink |
| `primary` | `#C5A253` champagne brass | `#8A6D1F` dark bronze |
| `secondary` | `#D9BE7E` lighter brass | `#6E5518` |
| `card` | `#131A2C` | `#FFFFFF` |
| `muted` / `muted-foreground` | `#1B2339` / `#9BA6BD` | `#F1EEE7` / `#545E76` |
| `border` | `#29344F` | `#E5E0D5` |
| `ring` | brass | bronze |

Light and dark are designed as one identity inverted, not a colour flip.
Every foreground/background pair is ≥4.5:1; `muted-foreground` is chosen to
stay above the body-text threshold in both modes. Light-mode `primary` is
deliberately darkened to bronze so brass-as-text still clears 4.5:1 on paper.

## Typography

- **Headings:** EB Garamond, weights 400–700 + italic (`next/font/google`).
  Display headings use `.tracking-display` (−0.02em) and `.text-balance`.
- **Body:** Source Sans 3, weights 400–600.
- **Eyebrows:** the `Eyebrow` component — 12px, `.tracking-eyebrow` (0.22em),
  uppercase, brass, preceded by a short gold rule.
- Data/years use `.tabular-nums`.

## Motion

Restrained ("elevated & tasteful", not showy — showy reads less
institutional). Every animation collapses to its final frame under
`prefers-reduced-motion` via the global rule in `globals.css`.

- **Hero trendline draw-in** — the appreciation line strokes itself in
  (`hero-draw` keyframe + `.hero-trendline`), endpoint fades in after.
- **Hero parallax** — `HeroBackground` drifts the backdrop on scroll,
  rAF-throttled and capped so it never detaches from the hero.
- **Scroll reveals** — `Reveal` fades/rises blocks on enter with a
  spring-like `cubic-bezier(0.16, 1, 0.3, 1)`, staggered ~90ms per item.
- **Hover** — quiet: a gold hairline grows in + a small lift. No
  attention-grabbing "dim the siblings" effects.

## Components

- `Eyebrow` — section label; use above every page `<h1>` and section head.
- `HeroBackground` — decorative, `aria-hidden`; skyline + trendline + faint
  grid + brass radial wash.
- `Reveal` — wrap blocks to reveal on scroll; `delay` prop for stagger.

## Accessibility guardrails

Unified `:focus-visible` ring (2px brass, 2px offset) on all interactive
elements; skip link; active-nav `aria-current="page"`; ≥44px touch targets;
`prefers-reduced-motion` respected. `src/app/a11y.test.tsx` runs jest-axe
against all four pages — extend it when adding pages.

## When extending

Reuse the tokens and the three `ui/` primitives. Keep to the type scale and
the 4/8px spacing rhythm. Do not introduce hardcoded colours, emoji icons, or
photography. If a new visual pattern is needed, add it here.
