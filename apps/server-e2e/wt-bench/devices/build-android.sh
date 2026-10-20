#!/bin/zsh
# Construit l'APK de DÉVELOPPEMENT (debug : il lit le bundle de Metro par
# `adb reverse tcp:8081 tcp:<port>`) et le dépose dans ~/.tentacle-lot-mob/builds/android/.
#   ~/.tentacle-lot-mob/heavy.sh wt-banc zsh apps/server-e2e/wt-bench/devices/build-android.sh
set -euo pipefail
REPO=${0:A:h}/../../../..
OUT=$HOME/.tentacle-lot-mob/builds/android
cd "$REPO/apps/mobile/android"
./gradlew --no-daemon -q assembleDebug
mkdir -p "$OUT"
cp app/build/outputs/apk/debug/*.apk "$OUT/"
echo "$(date '+%Y-%m-%d %H:%M') $(git -C "$REPO" log -1 --format='%h %s')" > "$OUT/BUILT_FROM.txt"
echo "Android prête : $(ls "$OUT"/*.apk)"
