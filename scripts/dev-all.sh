#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/backend/.env" ]; then
  echo "⚠️  backend/.env is missing. The frontend can still use the hosted API, but the local backend needs its private environment values."
fi

cleanup() {
  trap - INT TERM EXIT
  [ -n "${BACK_PID:-}" ] && kill "$BACK_PID" 2>/dev/null || true
  [ -n "${FRONT_PID:-}" ] && kill "$FRONT_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(cd "$ROOT/backend" && npm run dev) &
BACK_PID=$!
(cd "$ROOT/frontend" && npm run dev) &
FRONT_PID=$!

wait "$BACK_PID" "$FRONT_PID"
