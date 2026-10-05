#!/usr/bin/env bash
# Basic Auth guard: every path must demand credentials, both at "/" and under a
# basePath (the hidden-route setup). Regression test for a matcher that skipped the
# bare basePath root (the dashboard). Usage: npm run e2e:auth
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${E2E_AUTH_PORT:-3198}"
U=guy; P='s3cret:with-colon'
export PGLITE_DIR="$PWD/.data/auth-check"
unset DATABASE_URL
fail=0
expect() { # name expected actual
  if [ "$2" = "$3" ]; then echo "✓ $1 → $3"; else echo "✗ $1 → got $3, expected $2"; fail=1; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

for BP in "" "/vf-internal"; do
  echo "── basePath '${BP:-/}' ──"
  rm -rf "$PGLITE_DIR"
  ANALYZER_BASE_PATH="$BP" npx next build >/dev/null
  ANALYZER_BASE_PATH="$BP" BASIC_AUTH_USER=$U BASIC_AUTH_PASSWORD=$P \
    setsid ./node_modules/.bin/next start -p "$PORT" >"${TMPDIR:-/tmp}/vf-auth-server.log" 2>&1 &
  SERVER=$!
  trap 'kill -- -"$SERVER" 2>/dev/null || true' EXIT
  B="http://localhost:$PORT$BP"
  ROOT="$B"; [ -z "$BP" ] && ROOT="$B/"
  for _ in $(seq 1 60); do [ "$(code "$ROOT")" != "000" ] && break; sleep 1; done

  for path in "" "/" "/methodology" "/deals/new" "/deals/00000000-0000-0000-0000-000000000000"; do
    url="$B$path"; [ -z "$BP$path" ] && url="$B/"
    expect "no auth   ${BP}${path:-}" 401 "$(code -L "$url")"
    expect "wrong pw  ${BP}${path:-}" 401 "$(code -L -u "$U:nope" "$url")"
  done
  expect "malformed Authorization header" 401 "$(code -H 'Authorization: Basic %%%' "$ROOT")"
  expect "server-action POST, no auth" 401 "$(code -X POST -H 'Next-Action: x' "$ROOT")"
  expect "x-middleware-subrequest bypass (CVE-2025-29927)" 401 \
    "$(code -H 'x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware' "$ROOT")"
  expect "right pw  ${BP:-/}" 200 "$(code -u "$U:$P" "$ROOT")"
  expect "right pw  ${BP}/methodology" 200 "$(code -u "$U:$P" "$B/methodology")"
  ASSET=$(curl -s -u "$U:$P" "$ROOT" | grep -o "${BP}/_next/static/[^\"]*\.js" | head -1)
  expect "static asset, no auth" 401 "$(code "http://localhost:$PORT$ASSET")"
  expect "static asset, right pw" 200 "$(code -u "$U:$P" "http://localhost:$PORT$ASSET")"

  kill -- -"$SERVER" 2>/dev/null || true; trap - EXIT; sleep 1
done

echo "── fail-closed: production without a password ──"
ANALYZER_BASE_PATH="" npx next build >/dev/null
setsid env -u BASIC_AUTH_USER -u BASIC_AUTH_PASSWORD -u AUTH_DISABLED ./node_modules/.bin/next start -p "$PORT" >"${TMPDIR:-/tmp}/vf-auth-server.log" 2>&1 &
SERVER=$!
trap 'kill -- -"$SERVER" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do [ "$(code "http://localhost:$PORT/")" != "000" ] && break; sleep 1; done
expect "no password configured → refuses /" 503 "$(code "http://localhost:$PORT/")"
expect "no password configured → refuses /methodology" 503 "$(code "http://localhost:$PORT/methodology")"
expect "garbage Authorization header → refused" 503 "$(code -H 'Authorization: Basic %%%' "http://localhost:$PORT/")"
kill -- -"$SERVER" 2>/dev/null || true; trap - EXIT
rm -rf "$PGLITE_DIR"
[ "$fail" = 0 ] && echo "AUTH CHECK: all passed" || { echo "AUTH CHECK: FAILED"; exit 1; }
