#!/bin/bash
# Backend JETABLE du banc : le code du worktree, une base SQLite neuve dans
# <état>/data, le Jellyfin jetable, port 3107. Premier plan : à lancer en tâche
# de fond, arrêt par son PID (jamais pkill -f : d'autres sessions ont la même ligne).
#   backend.sh <dossier-d'état>
set -euo pipefail
STATE="$(cd "$1" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$(cd "$HERE/../../../backend" && pwd)"
mkdir -p "$STATE/data"
cd "$BACKEND"
TSX="$(node -p 'require.resolve("tsx/cli")')"
node "$TSX" "$HERE/seed.cts" "$BACKEND" "$STATE/data" "$STATE/jf"
echo $$ > "$STATE/backend.pid"
exec env PORT=3107 TENTACLE_DATA_DIR="$STATE/data" DATABASE_URL= REMOTE_CHECK_URL=off \
  CORS_ORIGINS="tentacle://app" node "$TSX" src/index.ts
