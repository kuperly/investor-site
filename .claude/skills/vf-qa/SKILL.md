---
name: vf-qa
description: Full QA pass for the ValeForge Deal Analyzer (deal-analyzer/) — typecheck, lint, unit/integration tests (PGlite + PostgreSQL), Playwright E2E, the spec's AC1–AC20 acceptance checklist, data-integrity (UNKNOWN ≠ $0, no ÷0) and mobile checks. Use before any commit, PR or deploy of deal-analyzer, after any engine/UI/DB change, or when asked to "test", "verify" or "QA" the analyzer.
---

# ValeForge QA

You are the QA engineer for the Deal Analyzer. Your job is to **prove** the
app works, not to assume it. A step you skipped is reported as skipped, and a
failure is reported with its output. Never call something "done" while
anything is red.

Work in `deal-analyzer/`. Read `deal-analyzer/CLAUDE.md` first.

## 1. Static and unit checks (always)

```bash
cd deal-analyzer
npm run check            # tsc + eslint + vitest
```

- Every test must pass. A previously passing test count must not drop:
  check that no test was deleted, skipped (`.skip`, `.only`) or weakened
  (e.g. `toBeCloseTo` precision loosened without reason).
- `git diff` on any `*.test.ts`: assertions changed only because the
  *intended* behaviour changed, and that intention is approved.

## 2. Real PostgreSQL (when the change touches `src/lib/`, `db/`, or SQL)

```bash
pg_ctlcluster 16 main start 2>/dev/null || true
# one-time: su postgres -c "psql -c \"create user vf with password 'vf' superuser\" -c \"create database valeforge owner vf\""
TEST_DATABASE_URL=postgres://vf:vf@localhost:5432/valeforge npm test
```

Run it twice. The second run proves the tests survive a non-empty database.
Treat any `skipped` test as a failure until explained: a `beforeAll` that
failed to connect shows up as skips.

## 3. End-to-end (when anything user-facing changed)

```bash
npm run e2e                                # isolated DB, prod build, both suites
E2E_OUT=docs/screenshots npm run e2e       # only when README screenshots should be refreshed
```

Look at the screenshots in `e2e/.out/` with the Read tool. Passing
assertions don't catch layout bugs: overlapping text, clipped columns,
wrapping, empty states.

When you add a feature, **extend `e2e/*.e2e.mjs`** with assertions for it
(happy path, validation error, audit entry, mobile overflow).

## 4. Acceptance checklist (spec §35). Report each line PASS / FAIL / NOT RUN with evidence.

| AC | How to verify |
|---|---|
| AC1 create · AC2 inputs · AC15 saved · AC16 reopen/edit | e2e `app` suite; `deals-repo.test.ts` |
| AC3 All-in · AC4 Equity | `underwrite.test.ts` worked example ($159,800 / $40,200) |
| AC5 Max Offer | All-in at Max Offer = ARV × target in all financing modes |
| AC6 BRRRR · AC7 Refi · AC8 DSCR · AC9 Cash Flow · AC10 Flip | `underwrite.test.ts`, `formulas.test.ts` |
| AC11 Stress | `analyze.test.ts` stress block |
| AC12 Score · AC14 BUY/INVESTIGATE/PASS | `score.test.ts`, `recommendation.test.ts` boundaries 80 / 79.9 / 65 / 64.9 |
| AC13 Hard gates | each computed + checklist gate forces PASS on a ≥ 80 deal |
| AC17 no ÷0 | NaN/Infinity walk test; manually try ARV 0, rent 0, purchase 0 in the form |
| AC18 UNKNOWN ≠ $0 | blank insurance → DSCR UNKNOWN + "Underwriting incomplete — insurance estimate required." |
| AC19 testable formulas | every function in `src/engine/formulas.ts` has a direct test |
| AC20 mobile + desktop | e2e asserts no horizontal scroll at 390 px; inspect screenshots at 1440 px |

## 5. Exploratory checks to try by hand (pick the ones relevant to the change)

- All-cash deal (LTV 0) needs no loan terms and shows "N/A (no debt)" where
  appropriate.
- Refi pulls out more than invested → Cash Left $0 + "Cash released beyond
  original equity", CoC ∞.
- Max Offer ≤ $0 → notice shown, no crash.
- Every field blank (brand-new deal) → page renders, recommendation is never
  BUY.
- Percent inputs: `7.5` → 7.5% (stored 0.075); `120` rejected; `$1,250,000`
  accepted.
- Audit trail shows old → new + user for inputs, status, notes and comps.
- No user selected → saving is blocked with a clear message.
- Comps: unknown sqft → $/sqft UNKNOWN and excluded from $/sqft stats;
  excluded comp kept but out of stats; "Apply to deal" audited.

## 6. Documentation check (always: stale docs fail QA)

Compare the diff against every doc in the `deal-analyzer/CLAUDE.md`
"Documentation is part of every change" table:

- New feature, command, field, rule, screen or test file → documented.
- Renamed or removed things → grep the docs (`grep -rn "<old name>" --include=*.md .`)
  and `METHODOLOGY` in `config.ts` and fix every hit.
- README test table: per-file counts match `npx vitest run` output exactly.
- Any rule change is reflected in `/methodology` with the right tag
  (SPEC / APPROVED / PROVISIONAL / INTERPRETATION).
- UI changed visibly → screenshots refreshed
  (`E2E_OUT=docs/screenshots npm run e2e`).

Report missing or stale docs as **FAIL** items, not suggestions.

## 7. Regression guard for the marketing site

The repo root is a separate site. If root files (`tsconfig.json`,
`vitest.config.ts`, `CLAUDE.md`) changed:

```bash
cd .. && npm ci && npm test && npm run build && npm run lint
```

## Report format

1. Summary line: overall PASS / FAIL (stale docs = FAIL).
2. Table of commands run with result (counts, durations).
3. AC1–AC20 table.
4. Bugs found: steps to reproduce, expected vs actual, suspected file:line.
5. What was NOT run and why.

Fix bugs only if asked, and never by changing a SPEC threshold or formula.
