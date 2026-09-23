#!/bin/bash
# Pilote l'émulateur Android TV au D-pad, capture comprise.
#   ./android.sh restart down down select wait:2 shot:filtres right select
# GARDE : aucune touche ne part si l'app n'est pas au premier plan — sinon
# elles tombent dans l'accueil Google TV (fiches de films, location, achat).
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb -s ${ANDROID_SERIAL:-emulator-5554}"
OUT="${BENCH_OUT:-$(dirname "$0")/out}"
PKG=com.tentacletv.mobile
mkdir -p "$OUT"
front() { $ADB shell dumpsys activity activities | grep -q "topResumedActivity=.*$PKG/"; }
key() {
  if ! front; then echo "ARRÊT : $PKG n'est pas au premier plan" >&2; exit 3; fi
  $ADB shell input keyevent "$1"
}
while [ $# -gt 0 ]; do
  case "$1" in
    up) key KEYCODE_DPAD_UP ;;
    down) key KEYCODE_DPAD_DOWN ;;
    left) key KEYCODE_DPAD_LEFT ;;
    right) key KEYCODE_DPAD_RIGHT ;;
    select) key KEYCODE_DPAD_CENTER ;;
    back) key KEYCODE_BACK ;;
    wait:*) sleep "${1#wait:}" ;;
    shot:*) name="${1#shot:}"; $ADB exec-out screencap -p > "$OUT/$name.png"; echo "capture $OUT/$name.png" ;;
    restart)
      $ADB shell am force-stop $PKG
      $ADB shell am start -n $PKG/com.tentacletv.MainActivity >/dev/null
      for i in $(seq 1 30); do
        front && break
        # Après un arrêt forcé, le lanceur reprend parfois la main : un second
        # lancement ramène la tâche de l'app devant.
        [ $((i % 5)) -eq 0 ] && $ADB shell am start -n $PKG/com.tentacletv.MainActivity >/dev/null
        sleep 1
      done
      if ! front; then echo "ARRÊT : l'app n'a pas pris le premier plan" >&2; exit 3; fi
      sleep 12 ;;
    *) echo "commande inconnue : $1" >&2; exit 2 ;;
  esac
  shift
  sleep 0.35
done
