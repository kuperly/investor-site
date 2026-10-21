#!/usr/bin/env bash
# End-to-end acceptance run: fresh isolated DB → seed → production build → start → browser suites.
# Usage: npm run e2e            (screenshots → e2e/.out/)
#        E2E_OUT=docs/screenshots npm run e2e   (refresh the documented screenshots)
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${E2E_PORT:-3199}"
export PGLITE_DIR="${PGLITE_DIR:-$PWD/.data/e2e}"
export E2E_BASE_URL="http://localhost:$PORT"
unset DATABASE_URL   # never run E2E against a real database
# Real sign-in: the first admin is bootstrapped from these on the first login (test values only).
export SESSION_SECRET="e2e-session-secret-$(date +%s)-0123456789abcdef"
export ADMIN_USERNAME="${E2E_ADMIN_USER:-guy}" ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-e2e-admin-password}" ADMIN_DISPLAY_NAME=Guy
unset AUTH_DISABLED
# No data-provider keys: VF-03 runs on the [DEMO] markets from the seed.
unset CENSUS_API_KEY HUD_API_TOKEN BLS_API_KEY FRED_API_KEY

if [ -z "${CHROMIUM_PATH:-}" ]; then
  CHROMIUM_PATH="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)"
  export CHROMIUM_PATH
fi

if curl -s -o /dev/null "$E2E_BASE_URL/login" 2>/dev/null; then
  echo "Port $PORT is already in use — stop that server (or set E2E_PORT) and retry." >&2
  exit 1
fi

rm -rf "$PGLITE_DIR"
npx tsx scripts/seed.ts >/dev/null
[ "${E2E_SKIP_BUILD:-}" = "1" ] || npx next build >/dev/null

# Own process group so cleanup also stops Next's child processes.
setsid ./node_modules/.bin/next start -p "$PORT" >"${TMPDIR:-/tmp}/vf-e2e-server.log" 2>&1 &
SERVER=$!
trap 'kill -- -"$SERVER" 2>/dev/null || kill "$SERVER" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf -o /dev/null "$E2E_BASE_URL/login" && break; sleep 1; done
curl -sf -o /dev/null "$E2E_BASE_URL/login" || { echo "Server did not start; see ${TMPDIR:-/tmp}/vf-e2e-server.log" >&2; exit 1; }

node e2e/app.e2e.mjs
node e2e/comps.e2e.mjs
node e2e/markets.e2e.mjs
echo "E2E: all suites passed"
