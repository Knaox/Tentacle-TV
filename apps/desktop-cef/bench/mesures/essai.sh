#!/usr/bin/env bash
# Essai rapide d'un levier RAM/CPU : lance le proto (drapeaux en plus), accueil au repos 30 s,
# diagnostic par processus 20 s (diag.py), puis arrêt propre par PID. Le verrou d'écran du lot
# doit être tenu par l'appelant.
#
#   bench/mesures/essai.sh <étiquette> [drapeaux CEF/Chromium…]
#   APP=…/Tentacle.app PORT=9311 PROFILE=… bench/mesures/essai.sh base
#   KIND=electron bench/mesures/essai.sh electron   # le bureau Electron, mêmes étapes
set -uo pipefail
HERE="${MESURES:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
CACHE="$HOME/.cache/tentacle-cef"
APP="${APP:-$CACHE/build/ram/Tentacle.app}"
PORT="${PORT:-9311}"
PROFILE="${PROFILE:-$CACHE/profiles/ram}"
OUT="${OUT:-$CACHE/build/ram-diag}"
TAG="$1"; shift
mkdir -p "$OUT"
while (( $(uptime | sed -E 's/.*load averages?: ([0-9]+).*/\1/') >= 20 )); do sleep 20; done

if [[ "${KIND:-cef}" == "electron" ]]; then
  # Bureau Electron 1.42.0 : copie re-signée, profil sous un faux HOME (comme passe.sh).
  PORT=9305
  CFFIXED_USER_HOME="$CACHE/profiles/electron-mesure/home" HOME="$CACHE/profiles/electron-mesure/home" \
    TENTACLE_LIQUID_GLASS=off "$CACHE/electron-copie/Tentacle TV.app/Contents/MacOS/Tentacle TV" \
    --use-mock-keychain --remote-debugging-port=$PORT "$@" > "$OUT/$TAG.log" 2>&1 &
else
  # --mute (règle du lot, axe lecteur) : mpv en ao=null + mute=yes, quoi que demande la page.
  "$APP/Contents/MacOS/Tentacle" --mute --url=http://127.0.0.1:3471 --devtools-port="$PORT" \
    --profile="$PROFILE" --background "$@" > "$OUT/$TAG.log" 2>&1 &
fi
PID=$!
trap 'kill "$PID" 2>/dev/null; for i in 1 2 3 4 5 6; do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done; kill -9 "$PID" 2>/dev/null' EXIT
for i in $(seq 60); do curl -s "http://127.0.0.1:$PORT/json/list" | grep -q '"page"' && break; sleep 0.5; done
sleep 4
echo "== $TAG ($*) — $(date +%H:%M:%S), uptime $(uptime | sed -E 's/.*averages?: //')"
echo "accueil : $(node "$HERE/scenario.mjs" "$PORT" accueil 2>&1 | tail -1)"
sleep "${REPOS:-30}"
python3 "$HERE/diag.py" --pid "$PID" --duree "${DUREE:-20}" --categories "${CATS:-4}"
# MEMDUMP=<préfixe> : relevé memory-infra en plus (ex. MEMDUMP=gpu/ pour le détail du GPU).
if [[ -n "${MEMDUMP:-}" ]]; then node "$HERE/memdump.mjs" "$PORT" 10 "$MEMDUMP" 3 | grep -vE "shared_memory/|global/|mailbox_"; fi
