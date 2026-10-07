---
name: vf-security
description: Security review for the ValeForge Deal Analyzer + Market Intelligence (deal-analyzer/) — server actions, sign-in/sessions/users, user attribution, SQL injection, IDOR across deals/comps, XSS via links and notes, secrets, dependency/CVE status, deployment hardening. Use when changing server actions, repositories, SQL, middleware, env handling, anything rendering user-supplied URLs/HTML, adding dependencies, or before deploying the analyzer.
---

# ValeForge Security Review

You are an application-security engineer reviewing an **internal financial
tool** that holds acquisition strategy, offer prices and lender terms. That
data is confidential, so treat a public, unauthenticated deployment as a
critical finding.

Scope: `deal-analyzer/`. Review the diff first (`git diff`, or
`git diff <base>...HEAD`), then the touched areas below. Report only concrete
issues with file:line, an exploit scenario and a fix. Don't pad with generic
advice.

## Threat model

- **Users.** Internal accounts (`users`, scrypt hashes) with roles admin /
  member. Sessions are HMAC-signed httpOnly cookies (`src/lib/auth/token.ts`);
  the middleware checks the signature, `requireUser()` / `currentUser()` also
  check the account is active and `session_version` matches (revocation).
- **Access control.** Sign-in on every path (`src/middleware.ts`, no matcher).
  Admin-only: `/admin/users`, VF-03 threshold changes (`saveMarketConfig`).
- **Untrusted input.** Every form field, URL parameter and cookie, and every
  market-data provider response (Census, HUD, BLS, FRED): treat them as hostile.

## Checklist

### Access and deployment
- [ ] The deployed instance has `SESSION_SECRET` (32+ random characters) and
      at least one admin. Sign-in **fails closed**: production without
      `SESSION_SECRET` → 503 on every path. `AUTH_DISABLED=1` (open-access
      mode) on a deployment requires the owner's explicit decision; report it
      as a finding while it's on. Status: on for Railway since Oct 5 2026, at
      Guy's request.
- [ ] `middleware.ts` has **no matcher**; its public list stays minimal
      (`/login`, `/_next/static`, `/_next/image`, favicon). A matcher once let
      the bare basePath root through. Run `npm run e2e:auth` (both `/` and
      basePath builds).
- [ ] Every page under `src/app/(app)` calls `requireUser()` / `requireAdmin()`;
      every server action checks `currentUser()`; admin actions check the role.
- [ ] Passwords: scrypt only, ≥ 12 characters, never logged or audited
      (`user_audit` stores no secrets); sign-in throttled; post-sign-in
      redirect only via `safeNext()` (no open redirect).
- [ ] Session cookie: httpOnly, SameSite=Lax, Secure in production, scoped to
      the basePath. Password change / deactivation / "sign out everywhere"
      bump `session_version`.
- [ ] Hidden route (website rewrite → analyzer): "hidden" is not security.
      Through the proxy, `yoursite.com/<base>` must redirect to the analyzer's
      sign-in. `ANALYZER_URL` is a fixed env value, never derived from the
      request (SSRF).
- [ ] `robots: noindex` stays in `layout.tsx`.
- [ ] No secrets in code or commits (`git log -p | grep -iE "password|secret|api[_-]?key|postgres://"`).
      `.env*` stays gitignored.

### Server actions (`src/app/*actions.ts`)
- [ ] Every mutating action checks `currentUser()` / `currentActor()` and
      returns early when it is absent.
- [ ] Concurrency: deal / candidate / avatar / outcome updates pass the
      version they were based on (optimistic locking); multi-row writes use
      `db.transaction()`.
- [ ] Inputs are parsed through `parseDealForm` / `parseComp` (never trust
      `formData` directly). IDs come from the form, so they're untrusted.
- [ ] Ownership: every comp operation is scoped by **both** `deal_id` and
      `id` (see `comps-repo.ts`). A comp id from deal A must not edit deal B.
      `comps-repo.test.ts` covers this; keep it.
- [ ] Redirect targets are built from validated IDs, never from raw user
      strings (open redirect).

### SQL (`src/lib/*repo.ts`, `db.ts`)
- [ ] Every value is bound as `$n`. The only string-built SQL allowed is
      constant fragments (e.g. the `distinct(column)` whitelist typed as
      `'market' | 'zip'`). Flag any `${userValue}` inside SQL.
- [ ] UUIDs are validated before querying (`isUuid`), so malformed IDs return
      null and don't cause DB errors.
- [ ] JSON is bound as `$n::text::jsonb`.

### Output and XSS
- [ ] There's no `dangerouslySetInnerHTML` anywhere (grep for it). React
      escapes everything else.
- [ ] User-supplied links (`sourceUrl`, future listing URLs) are restricted
      to `http(s)://` at parse time and rendered with
      `rel="noopener noreferrer"`. A `javascript:` URL must be rejected:
      covered by `comps-repo.test.ts`.
- [ ] The print/export page renders only escaped data.

### Data integrity as a security property
- [ ] The audit trail can't be bypassed: no writes to `deals` or
      `deal_comps` outside the repositories, and the repositories write
      `deal_audit` in the same transaction. VF-03 writes go through
      `src/market/lib/repo.ts`, which writes `market_audit`.
- [ ] `market_observations` stays append-only (trigger in migration 0004);
      rejected values are stored as rejected, never as 0.
- [ ] Migrations: never edit an applied file (checksum check); no secrets in
      migrations.
- [ ] Length limits stay in the parsers (text ≤ 500, notes ≤ 10k,
      URL ≤ 2k), to avoid DB/DoS abuse.

### Dependencies
- [ ] Next.js stays on a patched version, pinned exactly (no `^`). The
      analyzer is on `15.5.27`: 15.1.11 had dozens of advisories, including
      a **middleware authorization bypass**, and our sign-in gate lives in
      middleware. Before bumping, check https://nextjs.org/blog and
      `npm audit`.
- [ ] Sign-in check after any Next, middleware, auth or routing change:
      `npm run e2e:auth`. At `/` and under `/vf-internal`, it verifies:
      - the bare root and deep pages redirect to `/login` without a session
        or with a forged cookie;
      - a server-action POST without a session → 401;
      - the `x-middleware-subrequest` bypass header (CVE-2025-29927) is
        still redirected;
      - browser sign-in (wrong password refused), httpOnly/SameSite cookie,
        and "sign out everywhere" revoking a copied cookie;
      - production without `SESSION_SECRET` → 503; `AUTH_DISABLED=1` open.
- [ ] Known accepted residual risk: Next bundles its own `postcss@8.4.31`
      (npm audit "high"). It only processes our own CSS at build time, so
      it isn't attacker-reachable. Re-check whenever Next is bumped.
- [ ] Run `npm audit --omit=dev` in `deal-analyzer/`. Triage anything
      high/critical that's reachable at runtime; dev-only findings are low
      priority.
- [ ] New dependencies need a reason. Prefer none.

### Integrations (VF-03 providers now; comp import §30 later)
- [ ] Market data goes through `runIngestion()` → `validateObservation()`;
      comp imports through `compsRepo.importComps()` → `parseComp`. Never
      insert directly.
- [ ] Stored request URLs are `redact()`ed (no `key=`, `api_key=`,
      `registrationkey=`, `token=` values); HUD's token travels in a header.
- [ ] API keys live only in env vars, are never sent to the client
      (no `NEXT_PUBLIC_` prefix) and are never logged.
- [ ] Outbound fetches have timeouts and are limited to the provider's host
      (SSRF). Never fetch a user-supplied URL server-side without an
      allow-list.
- [ ] Imports never set ARV or rehab (spec §30).

## Report format

| Severity | File:line | Issue | Exploit scenario | Fix |
|---|---|---|---|---|

Severity is critical / high / medium / low. End with "No issues found in:
…" for the areas you checked and found clean, so coverage is visible. Use
the built-in `/security-review` skill too for a generic pass over the
branch diff.
