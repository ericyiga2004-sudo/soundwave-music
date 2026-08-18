#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if [ ! -f "$BACKEND/.env" ]; then
  echo "❌ backend/.env is missing."
  echo "Use ./scripts/dev-all.sh for hosted-API development, or restore backend/.env first."
  exit 1
fi

if ! grep -Eq 'mongodb(\+srv)?://' "$BACKEND/.env"; then
  echo "❌ backend/.env does not contain a valid MongoDB connection string."
  exit 1
fi

cleanup() {
  trap - INT TERM EXIT
  if [ -n "${BACK_PID:-}" ]; then kill "$BACK_PID" 2>/dev/null || true; fi
}
trap cleanup INT TERM EXIT

# Use node/npm start rather than background nodemon. nodemon reads stdin and
# macOS bash can suspend it as a background job with "Stopped".
(
  cd "$BACKEND"
  npm start </dev/null
) &
BACK_PID=$!

printf 'Starting local SoundWave API'
READY=0
for _ in $(seq 1 35); do
  if curl -fsS --max-time 2 http://localhost:4000/api/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  printf '.'
  sleep 1
done
printf '\n'

if [ "$READY" -ne 1 ]; then
  echo "❌ Local API did not become ready. The backend log above contains the cause."
  exit 1
fi

echo "✅ Local API ready at http://localhost:4000"

cd "$FRONTEND"
VITE_API_MODE=local \
VITE_ALLOW_LOCAL_API=true \
VITE_LOCAL_BACKEND_URL=http://localhost:4000 \
VITE_HOSTED_BACKEND_URL=https://soundwave-music.onrender.com \
exec npm run dev -- --host
