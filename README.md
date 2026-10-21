# ValeForge Capital — Marketing Site

Public marketing site for ValeForge Capital, an early-stage U.S. real estate
investment company — *Building Value from Opportunity.* Five pages — Home,
Approach, Strategies, About, Contact — plus placeholder legal pages.

> **Note:** brand settings live in `src/lib/site-config.ts` and page copy in
> `src/lib/content.ts`. See [CLAUDE.md](CLAUDE.md) for the placeholders that
> still need real values before launch.

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

## ValeForge Deal Analyzer

`deal-analyzer/` holds a separate internal app: a real-estate underwriting
engine with its own `package.json`, tests and docs. It isn't part of this
site's build or deploy. See [deal-analyzer/README.md](deal-analyzer/README.md).

## Docs

- [docs/apps/README.md](docs/apps/README.md) — **start here**: registry of every
  app in this repo, what each does, how they connect, and how to add a new one
  ([AGENTS.md](AGENTS.md) points agents to it)
- [CLAUDE.md](CLAUDE.md) — project reference for AI-assisted development:
  structure, conventions, known gotchas, pre-launch checklist
- [docs/design-system.md](docs/design-system.md) — visual system: palette,
  typography, motion, components, and the reasoning behind them
- [deal-analyzer/CLAUDE.md](deal-analyzer/CLAUDE.md) — rules for working on the
  internal app, including the docs-update checklist; one page per module in
  [deal-analyzer/docs/modules/](deal-analyzer/docs/modules/)
