#!/usr/bin/env bash
# Passe complète du pont dans CEF, sous le verrou d'écran du lot (pris au début, rendu à la fin
# quoi qu'il arrive) : HDR10, Dolby Vision, SDR (scénario vidéo, avec la sonde EDR EXTERNE de
# vidéo-HDR en parallèle), puis la robustesse. Journaux dans build/pont/passe-<heure>/.
#
#   web/shim/dev/pass-cef.sh [--foreground]   # --foreground : sans --background (le plein écran
#                                             # de macOS peut exiger une app active)
set -uo pipefail
# Bancs : jamais de son (`ao=null` + `mute=yes`), voir src/player/sound_policy.h.
export TENTACLE_MUTE=1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
APP="$CACHE/build/pont/Tentacle.app/Contents/MacOS/Tentacle"
PROBE="$CACHE/build/video-hdr/edr-probe/edr-probe"
LOCK="$CACHE/locks/ecran"
OUT="$CACHE/build/pont/passe-$(date +%H%M)"
BG="--background"; [[ "${1:-}" == "--foreground" ]] && BG=""
mkdir -p "$OUT"

mkdir "$LOCK" 2>/dev/null || { echo "verrou d'écran tenu : attendre"; exit 3; }
echo "pont $(date +%H:%M) passe CEF" > "$LOCK/qui"
APP_PID=""
cleanup() {
  [[ -n "$APP_PID" ]] && kill "$APP_PID" 2>/dev/null
  rm -f "$LOCK/qui"; rmdir "$LOCK" 2>/dev/null
  echo "verrou rendu — journaux : $OUT"
}
trap cleanup EXIT
# Référence : la marge AVANT toute vidéo du proto (attendue à 1,00).
"$PROBE" --hz 4 --duration 3 > "$OUT/edr-reference.txt" 2>&1
echo "== référence"; tail -1 "$OUT/edr-reference.txt"

"$APP" --mute --url=http://127.0.0.1:3471/ --devtools-port=9303 --profile="$CACHE/profiles/pont/cef" \
  --fake-video=off $BG > "$OUT/app.log" 2>&1 &
APP_PID=$!
sleep 8
node "$HERE/login.mjs" admin | tee "$OUT/login.txt"

for title in "Banc HDR10 Pistes (2026)" "Banc Dolby Vision Pistes (2026)" "Banc Pistes SDR (2026)"; do
  slug="$(echo "$title" | tr -cd '[:alnum:]')"
  "$PROBE" --hz 10 --duration 45 --changes > "$OUT/edr-$slug.txt" 2>&1 &
  probe=$!
  node "$HERE/scenario-video.mjs" "$title" > "$OUT/video-$slug.txt" 2>&1
  wait "$probe"
  echo "== $title"; grep -E "✅|❌|ℹ︎ (video-target|surface)|cas" "$OUT/video-$slug.txt"; tail -1 "$OUT/edr-$slug.txt"
  sleep 8  # la marge met plusieurs secondes à redescendre entre deux passes (vidéo-HDR)
done
node "$HERE/scenario-robustesse.mjs" > "$OUT/robustesse.txt" 2>&1
echo "== robustesse"; grep -E "✅|❌|cas" "$OUT/robustesse.txt"
