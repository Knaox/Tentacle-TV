#!/usr/bin/env bash
# Trace EDR (edr-trace.mjs + sonde externe) sous le verrou d'écran, app lancée en arrière-plan
# (défaut) ou au premier plan (`--foreground`) — pour départager « fenêtre inactive » et
# « réévaluation à la transition ».
set -uo pipefail
# Bancs : jamais de son (`ao=null` + `mute=yes`), voir src/player/sound_policy.h.
export TENTACLE_MUTE=1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
APP="$CACHE/build/pont/Tentacle.app/Contents/MacOS/Tentacle"
PROBE="$CACHE/build/video-hdr/edr-probe/edr-probe"
LOCK="$CACHE/locks/ecran"
MODE="${1:---background}"; BG="--background"; [[ "$MODE" == "--foreground" ]] && BG=""
OUT="$CACHE/build/pont/edr-trace-$(date +%H%M)${BG:+-bg}"
TITLE="${2:-Banc HDR10 Pistes (2026)}"
mkdir -p "$OUT"
mkdir "$LOCK" 2>/dev/null || { echo "verrou d'écran tenu : attendre"; exit 3; }
echo "pont $(date +%H:%M) trace EDR" > "$LOCK/qui"
APP_PID=""
trap '[[ -n "$APP_PID" ]] && kill "$APP_PID" 2>/dev/null; rm -f "$LOCK/qui"; rmdir "$LOCK" 2>/dev/null; echo "verrou rendu — $OUT"' EXIT
"$PROBE" --hz 4 --duration 3 | tail -1 | sed 's/^/référence : /'
"$APP" --mute --url=http://127.0.0.1:3471/ --devtools-port=9303 --profile="$CACHE/profiles/pont/cef" \
  --fake-video=off $BG > "$OUT/app.log" 2>&1 &
APP_PID=$!
sleep 8
node "$HERE/login.mjs" admin > /dev/null
"$PROBE" --hz 10 --duration 40 --changes > "$OUT/edr.txt" 2>&1 &
probe=$!
node "$HERE/edr-trace.mjs" "$TITLE" | tee "$OUT/trace.txt"
wait "$probe"
awk 'NR>1 && $3 ~ /edr/ {print $2, $3}' "$OUT/edr.txt" | awk '{split($2,a,"="); v=a[2]; if (NR==1 || (v-p)^2 > 1 || v==1.000) print "  sonde " $1 " s : " v; p=v}'
tail -1 "$OUT/edr.txt"
