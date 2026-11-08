#!/usr/bin/env bash
# Preuve du son sans rien entendre : l'app en mode SONDE (CoreAudio ouvert, échantillons à
# zéro, mpv né muet), connexion par le vrai formulaire, `son.mjs`, puis le journal de mpv
# (ouverture du périphérique CoreAudio). Tue l'app par son PID.
#   bench/lecteur/son.sh [build]      (défaut : $TENTACLE_CEF_CACHE/build/lecteur)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
BUILD="${1:-$CACHE/build/lecteur}"
OUT="$BUILD/runs/son-$(date +%H%M%S)"; mkdir -p "$OUT"
export PONT_CDP_PORT=9313

TENTACLE_SOUND_PROBE=1 TENTACLE_MPV_LOGFILE="$OUT/mpv-video.log" TENTACLE_MPV_LOGLEVEL=v \
  TENTACLE_MUSIC_MPV_LOGFILE="$OUT/mpv-musique.log" \
  "$BUILD/Tentacle.app/Contents/MacOS/Tentacle" --url=http://127.0.0.1:3471 --devtools-port=$PONT_CDP_PORT \
  --profile="$CACHE/profiles/lecteur" --background > "$OUT/app.log" 2>&1 &
APP_PID=$!
trap 'kill "$APP_PID" 2>/dev/null; echo "sorties : $OUT"' EXIT
for _ in $(seq 50); do curl -sf "http://127.0.0.1:$PONT_CDP_PORT/json" >/dev/null && break; sleep 0.3; done
sleep 4
grep "\[pont\] son" "$OUT/app.log"
[[ "$(node "$ROOT/web/shim/dev/cdp-eval.mjs" location.pathname)" == '"/login"' ]] && node "$ROOT/web/shim/dev/login.mjs" admin
node "$HERE/son.mjs" | tee "$OUT/banc.txt"
status=${PIPESTATUS[0]}
# Le périphérique ouvert, vu par mpv lui-même (niveau `v`).
echo "== journal mpv (vidéo) :"; grep -E "\[ao/coreaudio\]|\[ao\] |AO: \[" "$OUT/mpv-video.log" | head -8
echo "== journal mpv (musique) :"; grep -E "\[ao/coreaudio\]|AO: \[" "$OUT/mpv-musique.log" 2>/dev/null | head -4
exit "$status"
