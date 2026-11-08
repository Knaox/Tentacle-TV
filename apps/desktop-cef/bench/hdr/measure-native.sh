#!/usr/bin/env bash
# Mesure témoin : `mpv` NATIF (sa propre fenêtre, contexte macvk) sur un média, sonde EDR externe.
# Usage : measure-native.sh <média> <étiquette> [options mpv…]
# Sorties : $CACHE/build/video-hdr/mesures/<étiquette>.{probe,props,log}
# Son : --ao=null --mute=yes. Écran : prend le verrou partagé, le rend à la fin.
set -euo pipefail

CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MPV="${MPV_BIN:-$CACHE/deps/mpv/b5c712f4/bin/mpv}"
PROBE="${EDR_PROBE:-$CACHE/build/video-hdr/edr-probe/edr-probe}"
MEDIA="$1"; LABEL="$2"; shift 2
OUT="$CACHE/build/video-hdr/mesures"; mkdir -p "$OUT"
SOCK="$OUT/$LABEL.sock"; rm -f "$SOCK"

LOCK="$CACHE/locks/ecran"
until mkdir "$LOCK" 2>/dev/null; do echo "verrou écran pris, attente…" >&2; sleep 5; done
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

"$PROBE" --hz 20 --duration 12 --changes > "$OUT/$LABEL.probe" 2>/dev/null &
PROBE_PID=$!
"$MPV" --no-config --ao=null --mute=yes --vo=gpu-next --gpu-api=vulkan --gpu-context=macvk \
  --geometry=1280x720 --length=10 --media-controls=no --input-media-keys=no --input-default-bindings=no --ontop --input-ipc-server="$SOCK" --msg-level=all=v \
  --log-file="$OUT/$LABEL.log" "$@" "$MEDIA" >/dev/null 2>&1 &
MPV_PID=$!
sleep 6
python3 -I "$HERE/mpv_ipc.py" "$SOCK" video-params video-target-params current-vo \
  current-gpu-context > "$OUT/$LABEL.props" || true
wait "$MPV_PID" || true
wait "$PROBE_PID" || true
rm -f "$SOCK"

echo "== $LABEL"
grep -E "Metal layer (colorspace|HDR|pixel)|Swapchain|colorspace hint" "$OUT/$LABEL.log" | sed 's/^/  log: /' | head -8
python3 -I -c '
import json,sys
for l in open(sys.argv[1]):
    d=json.loads(l); v=d.get("value")
    if isinstance(v,dict):
        v={k:v[k] for k in ("primaries","gamma","max-luma","max-cll","sig-peak","colormatrix","pixelformat") if k in v}
    print("  prop:", d["prop"], v if v is not None else d.get("error"))
' "$OUT/$LABEL.props"
tail -1 "$OUT/$LABEL.probe" | sed 's/^/  probe: /'
