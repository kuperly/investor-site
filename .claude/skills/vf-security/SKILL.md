---
name: vf-security
description: Security review for the ValeForge Deal Analyzer (deal-analyzer/) — server actions, auth/basic-auth, user attribution, SQL injection, IDOR across deals/comps, XSS via links and notes, secrets, dependency/CVE status, deployment hardening. Use when changing server actions, repositories, SQL, middleware, env handling, anything rendering user-supplied URLs/HTML, adding dependencies, or before deploying the analyzer.
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

- **Users.** Two trusted internal users (Guy, Ben). No real login: the user
  picker is a cookie, for attribution, not authorization.
- **Access control.** The only access control on a deployed instance is
  `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` (`src/middleware.ts`) or Vercel
  deployment protection.
- **Untrusted input.** Every form field, URL parameter and cookie. In the
  future (§30), also provider/import data (Zillow, MLS, CSV): treat imported
  records as hostile.

## Checklist

### Access and deployment
- [ ] The deployed instance has Basic Auth env vars or platform protection.
      If not, it's critical.
- [ ] `middleware.ts` has **no matcher** and protects every path. A
      matcher once let the bare basePath root (`/vf-internal`, the dashboard)
      through without a password. Run `npm run e2e:auth`, which covers both
      `/` and basePath builds.
- [ ] Hidden route (website rewrite → analyzer): "hidden" is not security.
      The analyzer's own Basic Auth must answer through the proxy
      (`yoursite.com/<base>` → 401 + `WWW-Authenticate`). `ANALYZER_URL` is a
      fixed env value, never derived from the request (SSRF).
- [ ] `robots: noindex` stays in `layout.tsx`.
- [ ] No secrets in code or commits (`git log -p | grep -iE "password|secret|api[_-]?key|postgres://"`).
      `.env*` stays gitignored.

### Server actions (`src/app/*actions.ts`)
- [ ] Every mutating action checks `currentUser()` and returns early when it
      is absent.
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
      `deal_audit` in the same flow.
- [ ] Length limits stay in the parsers (text ≤ 500, notes ≤ 10k,
      URL ≤ 2k), to avoid DB/DoS abuse.

### Dependencies
- [ ] Next.js stays on a patched version, pinned exactly (no `^`). The
      analyzer is on `15.5.27`: 15.1.11 had dozens of advisories, including
      a **middleware authorization bypass**, and our Basic Auth lives in
      middleware. Before bumping, check https://nextjs.org/blog and
      `npm audit`.
- [ ] Basic Auth check after any Next, middleware or routing change:
      `npm run e2e:auth`. At `/` and under `/vf-internal`, it verifies 401
      for:
      - the bare root, the root with a trailing slash, and deep pages;
      - a wrong password;
      - a server-action POST;
      - a static asset;
      - the `x-middleware-subrequest` bypass header (CVE-2025-29927).

      Right credentials must return 200.
- [ ] Known accepted residual risk: Next bundles its own `postcss@8.4.31`
      (npm audit "high"). It only processes our own CSS at build time, so
      it isn't attacker-reachable. Re-check whenever Next is bumped.
- [ ] Run `npm audit --omit=dev` in `deal-analyzer/`. Triage anything
      high/critical that's reachable at runtime; dev-only findings are low
      priority.
- [ ] New dependencies need a reason. Prefer none.

### Future integrations (§30): enforce when they land
- [ ] Provider data goes through `compsRepo.importComps()` → `parseComp`
      (same validation as manual entry). Never insert directly.
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
