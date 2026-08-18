#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fail=0
check() {
  if "$@"; then return 0; else fail=1; return 1; fi
}

echo "SoundWave V22 live-social source checks"
check test -f "$ROOT/frontend/src/App.jsx" && echo "✅ frontend"
check test -f "$ROOT/backend/index.js" && echo "✅ backend"
check grep -q 'path="/social"' "$ROOT/frontend/src/App.jsx" && echo "✅ social overview"
check grep -q 'path="/social/share"' "$ROOT/frontend/src/App.jsx" && echo "✅ direct song sharing"
check grep -q 'path="/social/today"' "$ROOT/frontend/src/App.jsx" && echo "✅ one song today"
check grep -q 'path="/social/circles"' "$ROOT/frontend/src/App.jsx" && echo "✅ circles hub"
check grep -q 'path="/social/rooms"' "$ROOT/frontend/src/App.jsx" && echo "✅ rooms hub"
check grep -q 'path="/social/mix"' "$ROOT/frontend/src/App.jsx" && echo "✅ friend mix"
check grep -q 'path="/social/people"' "$ROOT/frontend/src/App.jsx" && echo "✅ people discovery"
check grep -q 'path="/social/rooms/:code"' "$ROOT/frontend/src/App.jsx" && echo "✅ live room detail"
check grep -q 'app.use("/api/social", socialRouter)' "$ROOT/backend/index.js" && echo "✅ social API mounted"
check grep -q 'router.post("/share-song"' "$ROOT/backend/routes/socialRouter.js" && echo "✅ song share API"
check grep -q 'app.use("/api/realtime", realtimeRouter)' "$ROOT/backend/index.js" && echo "✅ realtime SSE server"
check grep -q 'notification:new' "$ROOT/backend/controllers/notificationController.js" && echo "✅ realtime notifications"
check grep -q 'room:update' "$ROOT/backend/controllers/socialController.js" && echo "✅ realtime room updates"
check grep -q 'circle:update' "$ROOT/backend/controllers/socialController.js" && echo "✅ realtime circle updates"
check grep -q 'song:comment:update' "$ROOT/backend/controllers/commentController.js" && echo "✅ realtime comments and replies"
check grep -q 'song:moment:update' "$ROOT/backend/controllers/socialController.js" && echo "✅ realtime song moments"
check grep -q 'taste:update' "$ROOT/backend/controllers/personalizationController.js" && echo "✅ realtime taste updates"
check grep -q 'friendMixScore' "$ROOT/backend/controllers/socialController.js" && echo "✅ advanced Friend Mix scoring"
check grep -q 'soundwave-social-mutated' "$ROOT/frontend/src/hooks/useSocialHome.js" && echo "✅ local no-reload social invalidation"
check grep -q 'song_shared' "$ROOT/frontend/src/pages/NotificationBell.jsx" && echo "✅ shared-song notification playback"
check grep -q 'VITE_API_MODE=hosted' "$ROOT/frontend/.env" && echo "✅ hosted API default"

if command -v rg >/dev/null 2>&1 && rg -n 'localhost:4000' "$ROOT/frontend/src" "$ROOT/admin/src" >/tmp/soundwave-localhost-scan.txt 2>/dev/null; then
  echo "⚠️ Active source localhost references found:"
  cat /tmp/soundwave-localhost-scan.txt
  fail=1
else
  echo "✅ no hardcoded localhost API in app source"
fi

exit "$fail"
