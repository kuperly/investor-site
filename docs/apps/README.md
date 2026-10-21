# ValeForge apps: registry and system map

**Start here.** This page lists every app in this repository, what each one does,
where its code and docs live, and how the apps connect. Every app has its own page in
this folder (same layout, see [_template.md](_template.md)). Open that page before you
change the app.

## The apps

| App | What it does, in one line | Code | Users | Runs on | Docs |
|---|---|---|---|---|---|
| **Marketing site** | Public website for ValeForge Capital, built for credibility, not fundraising | repo root (`src/`) | The public: operators, property owners, financing and capital partners | Vercel, `valeforgecapital.com` (auto-deploys `main`) | [marketing-site.md](marketing-site.md) |
| **ValeForge internal app** | Internal tool for Guy and Ben: where to search → what to chase → whether to buy and at what price | `deal-analyzer/` (separate Next.js project) | Guy and Ben (accounts, sign-in) | Railway, served on the site at `/apps` | [valeforge-internal-app.md](valeforge-internal-app.md) |

The internal app has **three modules** behind one login. They form one chain of layers
([deal-analyzer/docs/LAYERS.md](../../deal-analyzer/docs/LAYERS.md)):

| Layers | Module | Question it answers | Page |
|---|---|---|---|
| 1–2 | **Market Intelligence (VF-03)** | *Where* should we search? KEEP / WATCH / DROP / DRILL DOWN per market and ZIP | [market-intelligence.md](../../deal-analyzer/docs/modules/market-intelligence.md) |
| 3–4 | **Deal Sourcing** | *What* do we chase there? Targets (area × buy box), leads, screening, feasibility, negotiation | [deal-sourcing.md](../../deal-analyzer/docs/modules/deal-sourcing.md) |
| 5–6 | **Deal Analyzer** | *Whether, and at what price?* BUY / INVESTIGATE / PASS per property, then actual results | [deal-analyzer.md](../../deal-analyzer/docs/modules/deal-analyzer.md) |

## System map

```
                         Public internet
                               │
          valeforgecapital.com │ (Vercel project "investor-site", repo root)
        ┌──────────────────────┴─────────────────────────┐
        │ Marketing site: / /approach /strategies /about │
        │ /contact /legal/*   ── /api/contact ─▶ Resend ─▶ deals@ / investment@
        │                                                │
        │ /apps/*  ── rewrite (next.config.ts) ──────────┼──▶ Railway "valeforge-deal-analyzer"
        └────────────────────────────────────────────────┘     service deal-analyzer (/apps/*)
                                                                │ sign-in (middleware + session)
                                                                ▼
                                    ┌─────────────── ValeForge internal app ────────────────┐
                                    │ Market Intelligence ─▶ Deal Sourcing ─▶ Deal Analyzer  │
                                    │   (src/market)          (src/sourcing)   (src/engine)  │
                                    └──────────────┬──────────────────────────────┬─────────┘
                                                   ▼                              ▼
                                       Railway PostgreSQL             Public data APIs (Census ACS,
                                       (one database, all modules)    HUD, BLS, FRED; keys on Railway)
```

## How the apps connect

There is exactly **one connection** between the two apps, and it is deliberately thin:

| Connection | From → to | Contract | Where it's defined | Tested by |
|---|---|---|---|---|
| Hidden route `/apps` | Marketing site → internal app | The site rewrites `/apps` and `/apps/*` to the internal app's deployment. The path must equal the internal app's build-time `ANALYZER_BASE_PATH`. The target defaults to the Railway URL; optional `ANALYZER_URL` overrides it (`off` disables). | Site: `next.config.ts` (`analyzerRewrites`). App: its own `next.config.ts` (`basePath`) | `src/lib/analyzer-route.test.ts`, `deal-analyzer` `npm run e2e:auth` |

The apps share **nothing else**:
- no code imports across the boundary (the site's `tsconfig.json` and `vitest.config.ts` exclude `deal-analyzer/`);
- no shared database, environment variables, session or login;
- separate `package.json`, tests, builds and deploys.

"Hidden" only means unlinked and not indexed. The internal app's own sign-in protects the data,
not the site.

Inside the internal app, the three modules **share one deployment, one database and one login**.
They connect only through explicit gates and contracts. Dependencies point up the chain:
the Deal Analyzer engine imports neither other module, and `src/boundary.test.ts` enforces it.
See each module's page, "Connections".

## Which doc for which task

| You want to… | Read |
|---|---|
| Change site copy, pages, design | [marketing-site.md](marketing-site.md) → root [CLAUDE.md](../../CLAUDE.md), [design-system.md](../design-system.md) |
| Change anything in the internal app | [valeforge-internal-app.md](valeforge-internal-app.md) → [deal-analyzer/CLAUDE.md](../../deal-analyzer/CLAUDE.md) (rules, definition of done) |
| Change underwriting math, score, gates, Max Offer | [deal-analyzer.md](../../deal-analyzer/docs/modules/deal-analyzer.md) → `docs/SPEC.md`, `docs/SPEC-ALIGNMENT.md`, skill `vf-underwriting-analyst` |
| Change market scoring or data sources | [market-intelligence.md](../../deal-analyzer/docs/modules/market-intelligence.md) → `docs/VF03-SPEC.md`, `docs/VF03-ALIGNMENT.md` |
| Change targets, leads, screening, negotiation | [deal-sourcing.md](../../deal-analyzer/docs/modules/deal-sourcing.md) → `docs/LAYERS.md` |
| Deploy, env vars, sign-in, `/apps` | [deal-analyzer/README.md → "Deploying"](../../deal-analyzer/README.md#deploying-the-apps-route-on-the-investor-website) |

## Rules that apply to every app

1. **Docs change in the same commit as the code** (root [CLAUDE.md](../../CLAUDE.md)). That includes
   this registry and the app's page whenever an app, module, route, connection or deploy target
   is added, changed or removed.
2. **Business thresholds and formulas change only with Guy/Ben's approval.** Propose the change,
   the rationale and the tests first. Rules carry their provenance (SPEC / APPROVED / PROVISIONAL /
   INTERPRETATION).
3. **No fabricated data or claims.** No invented track record on the site. No invented market data,
   comps or "successful" API calls in the internal app. Estimates are labelled, with source and date.
4. **UNKNOWN is never 0** in any calculation.
5. **Secrets live in the hosting dashboards** (Vercel, Railway), never in code, docs or chat.
6. **An app never reaches into another app's code or database.** A connection between apps is a
   documented contract (a URL, an API, a file format), listed in the table above, with a test.

## Adding a new app

1. **Decide where it lives.** Prefer its own folder at the repo root, or its own repository, with its
   own `package.json`. Exclude it from the site's `tsconfig.json` and `vitest.config.ts`. Add a new
   module inside the internal app only if it shares its users, login and database, and fits the
   layer chain.
2. **Write its page** from [_template.md](_template.md): `docs/apps/<app-name>.md`. For a module of
   the internal app, use `deal-analyzer/docs/modules/<module>.md` instead.
3. **Add a row** to "The apps" (or the modules table) above, and draw it on the system map.
4. **If it connects to another app, add the contract** to "How the apps connect", with the file that
   defines it and the test that guards it. Describe it on both apps' pages.
5. **Give it its own `CLAUDE.md`** (rules, commands, definition of done) if it has its own codebase.
   Link it from the root [CLAUDE.md](../../CLAUDE.md) and [AGENTS.md](../../AGENTS.md).
6. **Add project skills** under `.claude/skills/` if the app needs domain review (see the `vf-*`
   skills). List them on the app's page.

## Glossary

| Term | Meaning |
|---|---|
| ARV | After-repair value: the expected sale price once renovated |
| All-in | Purchase + closing + rehab + financing + holding costs |
| Max Offer | The highest purchase price at which All-in / ARV stays at the target (default 70%). A metric, never a rejection on its own |
| BRRRR | Buy, Rehab, Rent, Refinance, Repeat |
| DSCR | Debt service coverage ratio: NOI / annual debt service |
| Buy box / avatar | The property profile ValeForge is looking for (price, beds, sqft, year…), defined by Guy/Ben |
| Target | A geography × a buy box that sourcing is actively working |
| Lead / candidate | A specific property under a target, before full underwriting |
| MSA / CBSA | Metropolitan statistical area, keyed by the official Census CBSA code |
| UNKNOWN | A missing value. It is shown as UNKNOWN and never treated as 0 |
| SPEC / APPROVED / PROVISIONAL / INTERPRETATION | Where a rule comes from: the written spec, a Guy/Ben decision, a placeholder awaiting approval, or our reading of the spec |
