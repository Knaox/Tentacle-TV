#!/usr/bin/env bash
# Attend que la session soit déverrouillée (écran visible), puis lance une série de mesures
# EDR appariées, chacune encadrée par le témoin d'étalonnage (edr-calib) pour prouver que le
# système accordait l'EDR à ce moment-là. Une pause de 6 s sépare les passes (la marge met
# plusieurs secondes à redescendre après la fermeture d'une fenêtre EDR — mesuré).
# Usage : run-when-unlocked.sh <étiquette> <cas…>   où cas = calib | native | surface |
#   surface:VAR=1 (variable d'environnement passée au banc), ex. surface:TENTACLE_LAYER_TRANSLUCENT=1
#   calib:<options edr-calib>, ex. "calib:--opaque --fb-any"
set -uo pipefail
# Bancs : jamais de son (`ao=null` + `mute=yes`), voir src/player/sound_policy.h.
export TENTACLE_MUTE=1

CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$CACHE/build/video-hdr/bench/hdr-bench.app/Contents/MacOS/hdr-bench"
CALIB="$CACHE/build/video-hdr/edr-probe/edr-calib"
M="$CACHE/media/video"
OUT="$CACHE/build/video-hdr/mesures/$1"; shift
mkdir -p "$OUT"

# Lire toute la sortie avant de chercher : `grep -q` couperait le tube et, avec pipefail,
# le SIGPIPE d'ioreg ferait croire à un écran déverrouillé.
locked() { local x; x=$(ioreg -n Root -d1 -a); [[ "$x" == *"<key>CGSSessionScreenIsLocked</key>"* ]]; }
until ! locked; do sleep 20; done
sleep 5  # laisser l'animation de déverrouillage finir

LOCK="$CACHE/locks/ecran"
until mkdir "$LOCK" 2>/dev/null; do sleep 5; done
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

calib() { # $1 = nom, reste = options
  local name=$1; shift
  "$CALIB" --pq --value 0.75 --format bgr10a2 --seconds 3 "$@" > "$OUT/$name.calib" 2>&1
  echo "$name : témoin max $(awk '{print $3}' "$OUT/$name.calib" | sort -t= -k2 -n | tail -1)"
  sleep 6
}
n=0
for c in "$@"; do
  n=$((n + 1))
  locked && { echo "écran reverrouillé : arrêt"; break; }
  case "$c" in
    calib*) calib "$n-calib" ${c#calib:} ;;
    native|surface*)
      calib "$n-avant"
      envs=(); args=(--ontop --baseline 2 --seconds 5)
      [ "$c" = native ] && args+=(--native)
      [[ "$c" == surface:* ]] && envs=("${c#surface:}")
      env TENTACLE_VIDEO_LAYER_LOG=1 ${envs[@]+"${envs[@]}"} "$APP" "${args[@]}" --out "$OUT/$n-$c.bench" \
        "$M/hdr10-pq-4000nits.mkv" "$M/sdr-bt709.mkv" 2> "$OUT/$n-$c.err"
      echo "== $c"
      python3 -I - "$OUT/$n-$c.bench" <<'PY'
import json, sys
seg, vals = "référence", {}
for line in open(sys.argv[1]):
    _, kind, payload = line.rstrip("\n").split(" ", 2)
    if kind == "loadfile":
        seg = json.loads(payload)["file"].rsplit("/", 1)[-1]
    elif kind == "edr-inproc":
        vals.setdefault(seg, []).append(json.loads(payload)["edr"])
    elif kind == "window":
        print("   fenêtre :", payload)
for k, v in vals.items():
    print(f"   {k:28s} marge max={max(v):.2f} médiane={sorted(v)[len(v)//2]:.2f}")
PY
      sleep 6 ;;
  esac
done
