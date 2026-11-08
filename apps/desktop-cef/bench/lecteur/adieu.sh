#!/usr/bin/env bash
# Fermeture en pleine lecture : l'app (MUETTE), `adieu.mjs` (lecture, puis `shell.quit`), et
# l'app doit sortir d'elle-même. Tue l'app par son PID si elle traîne.
#   bench/lecteur/adieu.sh [build]      (défaut : $TENTACLE_CEF_CACHE/build/lecteur)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
BUILD="${1:-$CACHE/build/lecteur}"
OUT="$BUILD/runs/adieu-$(date +%H%M%S)"; mkdir -p "$OUT"
export PONT_CDP_PORT=9313 TENTACLE_MUTE=1

TENTACLE_PONT_TRACE=1 "$BUILD/Tentacle.app/Contents/MacOS/Tentacle" --mute --url=http://127.0.0.1:3471 \
  --devtools-port=$PONT_CDP_PORT --profile="$CACHE/profiles/lecteur" --background > "$OUT/app.log" 2>&1 &
APP_PID=$!
trap 'kill "$APP_PID" 2>/dev/null; echo "sorties : $OUT"' EXIT
for _ in $(seq 50); do curl -sf "http://127.0.0.1:$PONT_CDP_PORT/json" >/dev/null && break; sleep 0.3; done
sleep 4
[[ "$(node "$ROOT/web/shim/dev/cdp-eval.mjs" location.pathname)" == '"/login"' ]] && node "$ROOT/web/shim/dev/login.mjs" admin
node "$HERE/adieu.mjs" | tee "$OUT/banc.txt"
status=${PIPESTATUS[0]}
for _ in $(seq 40); do kill -0 "$APP_PID" 2>/dev/null || break; sleep 0.25; done
if kill -0 "$APP_PID" 2>/dev/null; then echo "❌ l'app ne s'est pas fermée seule en 10 s"; status=1
else wait "$APP_PID"; echo "✅ l'app s'est fermée seule (code $?)"; fi
echo "== dernières commandes de la page vers mpv :"; grep "\[pont-trace\]" "$OUT/app.log" | tail -4 | cut -c1-160
exit "$status"
