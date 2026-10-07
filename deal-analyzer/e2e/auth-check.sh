#!/usr/bin/env bash
# Sign-in guard: every path must require a session, both at "/" and under a basePath (the
# hidden-route setup). Regression test for a matcher that skipped the bare basePath root.
# Also: forged / tampered cookies, server-action POSTs, the middleware-bypass CVE, fail-closed
# without SESSION_SECRET, and a real browser sign-in under the basePath. Usage: npm run e2e:auth
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${E2E_AUTH_PORT:-3198}"
export PGLITE_DIR="$PWD/.data/auth-check"
unset DATABASE_URL AUTH_DISABLED
export SESSION_SECRET="auth-check-secret-0123456789abcdef-0123456789"
export ADMIN_USERNAME=guy ADMIN_PASSWORD='auth:check-password' ADMIN_DISPLAY_NAME=Guy
if [ -z "${CHROMIUM_PATH:-}" ]; then
  CHROMIUM_PATH="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)"
  export CHROMIUM_PATH
fi
fail=0
expect() { # name expected actual
  if [ "$2" = "$3" ]; then echo "✓ $1 → $3"; else echo "✗ $1 → got $3, expected $2"; fail=1; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
location() { curl -s -o /dev/null -w '%{redirect_url}' "$@"; }

for BP in "" "/vf-internal"; do
  echo "── basePath '${BP:-/}' ──"
  rm -rf "$PGLITE_DIR"
  ANALYZER_BASE_PATH="$BP" npx next build >/dev/null
  ANALYZER_BASE_PATH="$BP" setsid ./node_modules/.bin/next start -p "$PORT" >"${TMPDIR:-/tmp}/vf-auth-server.log" 2>&1 &
  SERVER=$!
  trap 'kill -- -"$SERVER" 2>/dev/null || true' EXIT
  B="http://localhost:$PORT$BP"
  ROOT="$B"; [ -z "$BP" ] && ROOT="$B/"
  for _ in $(seq 1 60); do [ "$(code "$B/login")" != "000" ] && break; sleep 1; done

  # Next normalizes "<basePath>/" to "<basePath>" (308) before anything renders; that target is checked below.
  if [ -n "$BP" ]; then expect "trailing slash ${BP}/ → normalized" "308 $B" "$(code "$B/") $(location "$B/")"; fi
  for path in "" $([ -z "$BP" ] && echo "/") "/methodology" "/deals/new" "/markets" "/markets/cbsa%3A19100" "/admin/users" "/deals/00000000-0000-0000-0000-000000000000"; do
    url="$B$path"; [ -z "$BP$path" ] && url="$B/"
    expect "no session  ${BP}${path:-}" 307 "$(code "$url")"
    loc="$(location "$url")"; case "$loc" in "http://localhost:$PORT$BP/login"*) r=login;; *) r="$loc";; esac
    expect "  redirects to ${BP}/login" login "$r"
    expect "forged cookie ${BP}${path:-}" 307 "$(code -b 'vf_session=eyJ1aWQiOiJ4Iiwic3YiOjEsImV4cCI6OTk5OTk5OTk5OTk5OX0.AAAA' "$url")"
  done
  expect "login page is public" 200 "$(code "$B/login")"
  expect "server-action POST, no session" 401 "$(code -X POST -H 'Next-Action: x' "$ROOT")"
  expect "x-middleware-subrequest bypass (CVE-2025-29927)" 307 \
    "$(code -H 'x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware' "$ROOT")"
  E2E_BASE_URL="$B" E2E_ADMIN_USER=guy E2E_ADMIN_PASSWORD="$ADMIN_PASSWORD" node e2e/auth.e2e.mjs || fail=1

  kill -- -"$SERVER" 2>/dev/null || true; trap - EXIT; sleep 1
done

echo "── fail-closed: production without SESSION_SECRET ──"
ANALYZER_BASE_PATH="" npx next build >/dev/null
setsid env -u SESSION_SECRET -u AUTH_DISABLED ./node_modules/.bin/next start -p "$PORT" >"${TMPDIR:-/tmp}/vf-auth-server.log" 2>&1 &
SERVER=$!
trap 'kill -- -"$SERVER" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do [ "$(code "http://localhost:$PORT/")" != "000" ] && break; sleep 1; done
expect "no SESSION_SECRET → refuses /" 503 "$(code "http://localhost:$PORT/")"
expect "no SESSION_SECRET → refuses /markets" 503 "$(code "http://localhost:$PORT/markets")"
expect "no SESSION_SECRET → refuses /login too (cannot sign in)" 503 "$(code "http://localhost:$PORT/login")"
kill -- -"$SERVER" 2>/dev/null || true; trap - EXIT; sleep 1

echo "── open-access mode (AUTH_DISABLED=1, owner's decision) ──"
setsid env -u SESSION_SECRET AUTH_DISABLED=1 ./node_modules/.bin/next start -p "$PORT" >"${TMPDIR:-/tmp}/vf-auth-server.log" 2>&1 &
SERVER=$!
trap 'kill -- -"$SERVER" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do [ "$(code "http://localhost:$PORT/")" != "000" ] && break; sleep 1; done
expect "AUTH_DISABLED=1 → / open" 200 "$(code "http://localhost:$PORT/")"
expect "AUTH_DISABLED=1 → /admin/users not available (no admin)" 307 "$(code "http://localhost:$PORT/admin/users")"
kill -- -"$SERVER" 2>/dev/null || true; trap - EXIT
rm -rf "$PGLITE_DIR"
[ "$fail" = 0 ] && echo "AUTH CHECK: all passed" || { echo "AUTH CHECK: FAILED"; exit 1; }
