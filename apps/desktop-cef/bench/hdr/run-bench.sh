#!/usr/bin/env bash
# Jalon H1 : lance le banc SDL3 (hdr-bench.app, par `open -g` : pas de vol de focus) avec la
# sonde EDR externe, puis résume par fichier : headroom mesuré, video(-target)-params, couche.
# Usage : run-bench.sh <étiquette> [options hdr-bench…] fichier…
# Sorties : $CACHE/build/video-hdr/mesures/<étiquette>.{bench,probe,err,mpv.log}
set -euo pipefail

CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="${HDR_BENCH_APP:-$CACHE/build/video-hdr/bench/hdr-bench.app}"
PROBE="${EDR_PROBE:-$CACHE/build/video-hdr/edr-probe/edr-probe}"
LABEL="$1"; shift
OUT="$CACHE/build/video-hdr/mesures"; mkdir -p "$OUT"
rm -f "$OUT/$LABEL".{bench,probe,err,mpv.log}

LOCK="$CACHE/locks/ecran"
until mkdir "$LOCK" 2>/dev/null; do echo "verrou écran pris, attente…" >&2; sleep 5; done
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

"$PROBE" --hz 20 > "$OUT/$LABEL.probe" 2>/dev/null &
PROBE_PID=$!
sleep 0.5
# -n : nouvelle instance ; -W : attendre sa fin ; -g : ne pas activer l'app.
ENVS=(--env TENTACLE_VIDEO_LAYER_LOG=1 --env TENTACLE_MUTE=1)  # bancs : jamais de son
for v in ${BENCH_ENV:-}; do ENVS+=(--env "$v"); done  # ex. BENCH_ENV="BENCH_PLAIN_WINDOW=1"
open -g -n -W "${ENVS[@]}" \
  --stderr "$OUT/$LABEL.err" -a "$APP" --args --ontop --out "$OUT/$LABEL.bench" \
  --mpv-log "$OUT/$LABEL.mpv.log" "$@"
sleep 0.5
kill "$PROBE_PID" 2>/dev/null || true
wait "$PROBE_PID" 2>/dev/null || true

python3 -I "$HERE/summarize.py" "$OUT/$LABEL.bench" "$OUT/$LABEL.probe" "$OUT/$LABEL.err"
