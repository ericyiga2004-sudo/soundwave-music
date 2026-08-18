#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# V20 default development mode intentionally uses the hosted Render API.
# That means one Terminal window, no suspended nodemon job, and no dead
# localhost:4000 dependency.
rm -f "$ROOT/frontend/.env.local" \
      "$ROOT/frontend/.env.development.local" \
      "$ROOT/frontend/.env.production.local"

export VITE_API_MODE=hosted
export VITE_HOSTED_BACKEND_URL="https://soundwave-music.onrender.com"
unset VITE_ALLOW_LOCAL_API || true
unset VITE_LOCAL_BACKEND_URL || true

cd "$ROOT/frontend"
echo "SoundWave V20 — hosted API development"
echo "Frontend: http://localhost:5173"
echo "API:      https://soundwave-music.onrender.com"
echo
exec npm run dev -- --host
