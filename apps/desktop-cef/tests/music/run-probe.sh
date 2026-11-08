#!/usr/bin/env bash
# Lance le faux natif d'Octave : construit, sert la musique de test (serveur
# local à plages, en-tête exigé), joue les scénarios, arrête le serveur PAR PID.
# Aucun son : `ao=null` par défaut (règle du lot), et l'instance naît muette, volume 0.
#   tests/music/run-probe.sh [ao]      ex. : tests/music/run-probe.sh coreaudio (muet)
set -euo pipefail
# Bancs : jamais de son (`ao=null` + `mute=yes`), voir src/player/sound_policy.h.
export TENTACLE_MUTE=1
HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
# OCTAVE_WITH_PLAYER=1 : sur le `Player` de vidéo-HDR (libmpv du fork).
if [ "${OCTAVE_WITH_PLAYER:-0}" = 1 ]; then BUILD="$CACHE/build/octave-player"; WITH=ON; else BUILD="$CACHE/build/octave"; WITH=OFF; fi
MEDIA="$CACHE/media/musique"
PORT="${OCTAVE_PROBE_PORT:-9314}"
AUTH='MediaBrowser Client="Tentacle", Device="octave-probe", Token="banc-octave"'
[ -f "$MEDIA/MANIFEST.json" ] || "$HERE/../../bench/music/make-music.sh"
cmake -S "$HERE" -B "$BUILD" -G Ninja -DCMAKE_BUILD_TYPE=RelWithDebInfo -DOCTAVE_WITH_PLAYER=$WITH >/dev/null
ninja -C "$BUILD" -j4 octave_probe
python3 -I "$HERE/serve_range.py" "$MEDIA" "$PORT" "$AUTH" 2>"$BUILD/serveur.log" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
sleep 0.5
"$BUILD/octave_probe" "http://127.0.0.1:$PORT" "$AUTH" "${1:-null}"
