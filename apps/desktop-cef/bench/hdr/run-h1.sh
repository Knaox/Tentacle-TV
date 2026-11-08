#!/usr/bin/env bash
# Jalon H1 — toute la matrice de preuves, à la suite (chaque passe prend le verrou d'écran).
# Résumés : $CACHE/build/video-hdr/mesures/h1-*.txt
set -uo pipefail
# Bancs : jamais de son (`ao=null` + `mute=yes`), voir src/player/sound_policy.h.
export TENTACLE_MUTE=1

CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
HERE="$(cd "$(dirname "$0")" && pwd)"
M="$CACHE/media/video"
OUT="$CACHE/build/video-hdr/mesures"; mkdir -p "$OUT"
SEQ=("$M/hdr10-pq-4000nits.mkv" "$M/dv-p81-4000nits.mkv" "$M/dv-p5-4000nits.mkv"
     "$M/sdr-bt709.mkv" "$M/hdr10-pq-4000nits.mkv")

run() { # $1 = étiquette, $2 = BENCH_ENV, reste = arguments du banc
  local label=$1 envs=$2; shift 2
  echo "### $label (BENCH_ENV=${envs:-—}) : $*" | sed "s|$M/||g"
  BENCH_ENV="$envs" "$HERE/run-bench.sh" "$label" "$@" 2>&1 | grep -v "verrou écran" \
    | tee "$OUT/$label.txt"
}

run h1-surface "" --seconds 6 "${SEQ[@]}"
run h1-native "" --native --seconds 6 "${SEQ[@]}"
run h1-show-first "BENCH_SHOW_FIRST=1" --seconds 6 "$M/hdr10-pq-4000nits.mkv"
run h1-sdl-srgb "TENTACLE_KEEP_WINDOW_COLORSPACE=1" --seconds 6 "$M/hdr10-pq-4000nits.mkv"
run h1-fullscreen "" --fullscreen --seconds 8 "$M/hdr10-pq-4000nits.mkv" "$M/sdr-bt709.mkv"
run h1-resize "" --resize-at 3 --seconds 7 "$M/hdr10-pq-4000nits.mkv"
run h1-overlay "" --overlay 0.6 --seconds 6 "$M/hdr10-pq-4000nits.mkv"
