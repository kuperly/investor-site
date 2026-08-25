# G&B Capital — Investor Site

Marketing site for a real estate investment company. Four pages — Home,
Approach, About, Contact — built to establish credibility with investors
and real estate professionals ahead of an active launch.

> **Note:** "G&B Capital" is a provisional company name, set in
> `src/lib/site-config.ts`. See [CLAUDE.md](CLAUDE.md) for what else needs
> swapping before this goes live.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Resend (contact form
email) · Vitest + React Testing Library + jest-axe (tests)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To exercise the contact form locally, copy `.env.example` to `.env.local`
and fill in a Resend API key and the two email addresses.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm test` | Run the full test suite |
| `npm run build` | Production build |
| `npm run lint` | Lint the codebase |

## Docs

- [CLAUDE.md](CLAUDE.md) — project reference for AI-assisted development:
  structure, conventions, known gotchas, pre-launch checklist
- [docs/design-system.md](docs/design-system.md) — visual system: palette,
  typography, motion, components, and the reasoning behind them
