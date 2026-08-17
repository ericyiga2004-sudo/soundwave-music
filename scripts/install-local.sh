#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Installing SoundWave dependencies..."
for APP in backend frontend admin; do
  echo "→ $APP"
  (cd "$ROOT/$APP" && npm install)
done

echo "Done. Copy backend/.env.example to backend/.env and fill in your private values if you want to run the local API."
