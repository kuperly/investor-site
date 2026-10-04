# ValeForge Deal Analyzer — CLAUDE.md

Internal underwriting engine for ValeForge (US real-estate investing). Users:
Guy and Ben. Core principle: **the deal chooses the strategy**, so every deal
is evaluated as BRRRR, Hold, Flip and Hybrid.

- Spec (source of truth, § numbers used in code): [docs/SPEC.md](docs/SPEC.md)
- Overview, architecture, open decisions, limitations: [README.md](README.md)
- Every rule + provenance: `src/engine/config.ts` → rendered at `/methodology`

## Non-negotiable rules

1. **No invented business rules, thresholds, market data, lender terms or
   property data.** If the spec doesn't define something, don't guess.
   - Make it an input, or
   - add it to `config.ts` tagged `PROVISIONAL` and list it under "Decisions
     that need Guy/Ben approval" in README.md, or
   - ask.
2. **Changing any SPEC value or formula needs explicit approval.** Stop and ask
   before touching `SPEC` in `config.ts` or the formulas in
   `src/engine/formulas.ts`, `underwrite.ts`, `score.ts`, `recommendation.ts`
   or `gates.ts`. When something is approved, retag it from PROVISIONAL to APPROVED,
   note who approved it and when, and remove it from the README's open
   decisions.
3. **UNKNOWN is never $0 (AC18).** Missing numeric input = `null`.
   - Compose with `lift()` / `sumKnown()` in `underwrite.ts`; never `?? 0` on
     an input.
   - The UI shows `UNKNOWN`, and only an explicitly entered 0 is zero.
   - New fields must flow through `InputReader` so they appear in the
     "Underwriting incomplete — …" warnings.
4. **No division by zero (AC17).** Use `safeDivide`; CoC with $0 left is
   `INFINITE`.
5. **All business logic lives in `src/engine/`.** It is pure TypeScript: no
   React, no I/O, no `Date.now()` (pass `asOf`).
   - Components only format numbers that `analyzeDeal()` / `compStats()`
     return.
   - Formatting lives in `src/lib/format.ts`.
6. **Every formula gets a test with a hand-calculated expectation**, with the
   arithmetic in a comment. Match the spec's examples where it gives one
   (e.g. $60K / $54K = 90%).
7. **Every change is audited (§33).** Deal inputs, notes, status and comps all
   write `deal_audit` rows through the repositories. Don't write to `deals`
   or `deal_comps` outside `deals-repo.ts` / `comps-repo.ts`.
8. **Comps suggest ARV; only the user applies it.** The comp-supported Base
   ARV (`compArv` in `comps.ts`: weighted $/sqft of renovated comps × subject
   sqft) changes `arvBase` only via the audited "Apply" action. Imports (§30)
   may fill property facts, never ARV or rehab, without that explicit step.
   Weighting numbers in `PROVISIONAL.compArv` await confirmation.
9. **Hard gates beat the score.** Never let a score path reach BUY with a
   FAIL or UNKNOWN gate.

## Commands

```bash
npm run dev          # http://localhost:3100 (PGlite in .data/pglite unless DATABASE_URL is set)
npm run check        # typecheck + lint + unit/integration tests — run before every commit
npm test             # vitest (unit + integration)
TEST_DATABASE_URL=postgres://… npm test   # repo tests against real PostgreSQL too
npm run e2e          # isolated DB + prod build + Playwright suites (e2e/*.e2e.mjs)
E2E_OUT=docs/screenshots npm run e2e      # refresh the README screenshots
npm run db:seed      # [DEMO] deals + comps (illustrative only)
npm run db:migrate   # apply db/schema.sql to DATABASE_URL
```

Local PostgreSQL in a cloud session: `pg_ctlcluster 16 main start`, then
create a superuser role and a database for `TEST_DATABASE_URL`.

## Map

```
src/engine/   types · config (SPEC/PROVISIONAL) · fields (input registry) · finance · formulas
              underwrite (+ Max Offer solver) · stress · strategies · gates · score
              recommendation · comps · analyze (single entry point) · fixtures (test data)
src/lib/      db (postgres.js | PGlite) · deals-repo · comps-repo · comps/{parse-comp,provider}
              parse-inputs · audit · audit-format · format · session/users
src/app/      / dashboard · /deals/new · /deals/[id] · /deals/[id]/edit · /deals/[id]/comps
              /deals/[id]/export · /methodology · actions.ts · comps-actions.ts
db/schema.sql idempotent; applied automatically at startup
e2e/          run.sh + app.e2e.mjs + comps.e2e.mjs
```

## Adding an input field

1. Add it to `DealInputs` in `types.ts`.
2. Add it to `FIELD_SECTIONS` in `fields.ts`. The form, parser, export and
   audit labels all pick it up from there.
3. Read it with `reader.num()` in the engine.
4. Add tests:
   - a parser round-trip;
   - an engine test with the value known;
   - an engine test with the value `null` (UNKNOWN propagates and is listed in
     `missing`).
5. Old deals read it as UNKNOWN automatically (`toRecord` merges onto
   `emptyInputs()`). No migration is needed.

## Dependencies

- **Next.js is pinned exactly at `15.5.27`** (security). Never use `^` for
  `next` or `eslint-config-next`. Bump only after checking the advisories
  and running `npm run check`, `npm run e2e` and the `vf-security` Basic Auth
  smoke test.
- `next.config.ts` sets `outputFileTracingRoot` because the repo root has
  its own lockfile.
- `e2e/run.sh` refuses to start if its port (3199) is busy. A stale server
  serving a rebuilt `.next` gives confusing failures.

## Database gotchas

- **Bind JSON as `$n::text::jsonb`.** postgres.js otherwise stores a JSON
  *string* instead of an object.
- **Numeric columns are `double precision` / `integer`** so drivers return JS
  numbers. Dates are read via `to_char(... 'YYYY-MM-DD')` to avoid timezone
  shifts.
- **Schema setup runs in one transaction behind an advisory lock**
  (`db.migrate`), because concurrent cold starts race otherwise. Schema
  changes must stay idempotent (`if not exists`).
- **PGlite is single-process.** Stop the dev server before running
  `db:seed` on the same directory. Deployed instances must set
  `DATABASE_URL`.
- **Tests on a persistent DB** must use unique values (e.g. `Date.now()`) and
  never assume an empty table.

## Project skills (`/<name>`, defined in `../.claude/skills/`)

| Skill | Use it when |
|---|---|
| `vf-qa` | Before every commit / PR: full verification and the AC1–AC20 checklist |
| `vf-security` | Touching auth, server actions, repos, SQL, links, env, deps, or before deploying |
| `vf-underwriting-analyst` | Any change to engine math, scoring, gates or recommendations; auditing a deal's numbers |
| `vf-real-estate-investor` | Product and logic review from an acquisitions / BRRRR operator's point of view |
| `vf-property-inspector` | Rehab scope, condition, hard-gate checklist and inspection workflow review |

Persona skills (investor, inspector, analyst) **produce findings and
questions for Guy/Ben**. They never change thresholds or formulas on their
own.

## Documentation is part of every change (mandatory)

Docs are updated **in the same commit** as the code they describe: never
"later", never in a follow-up. Before every commit, check each doc below
against the change. **Add** what's new, **update** what changed, and
**remove** what's no longer true (stale docs are worse than missing ones).

| Doc | Update when |
|---|---|
| `README.md` | Features, commands, architecture map, DB schema, test table (file / count / covers), screenshots list, open decisions, known limitations, deploy steps |
| `CLAUDE.md` (this file) | Rules, commands, code map, gotchas, skills, definition of done |
| `src/engine/config.ts` → `METHODOLOGY` | Any rule added or changed, tagged SPEC / APPROVED / PROVISIONAL / INTERPRETATION. When Guy/Ben approve a provisional rule, retag it and remove it from README "Decisions that need approval" |
| `docs/SPEC.md` | Never edited, except to add a new spec version from Guy/Ben verbatim |
| `docs/screenshots/` | UI changed visibly: `E2E_OUT=docs/screenshots npm run e2e` |
| `../CLAUDE.md` (repo root) | The analyzer's location, skills list or isolation from the site changes |
| `../.claude/skills/vf-*` | A skill's commands, checklist, file paths or rules no longer match the code |

Prefer facts that can't go stale: no hardcoded counts or versions in prose
unless the doc owns that number (the README test table does; keep it
exact). Before committing, grep the docs for names you renamed or removed.

## Definition of done

1. `npm run check` is green.
2. `npm run e2e` is green for any UI or flow change.
3. New logic has hand-calculated tests.
4. **All affected docs are updated in the same commit** (see "Documentation
   is part of every change"): README, this file, `METHODOLOGY`, screenshots,
   skills, and the root CLAUDE.md. Stale statements are removed.
5. No new UNKNOWN-to-0 paths.
6. The marketing site at the repo root still builds. It excludes
   `deal-analyzer/`; don't import across the boundary.
