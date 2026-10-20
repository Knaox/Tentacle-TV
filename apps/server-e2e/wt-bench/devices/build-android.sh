#!/bin/zsh
# Construit l'APK de DÉVELOPPEMENT (debug : il lit le bundle de Metro par
# `adb reverse tcp:8081 tcp:<port>`) et le dépose dans ~/.tentacle-lot-mob/builds/android/.
#   ~/.tentacle-lot-mob/heavy.sh wt-banc zsh apps/server-e2e/wt-bench/devices/build-android.sh
set -euo pipefail
# Premier argument facultatif : le dépôt (worktree) à construire — par défaut celui du script.
REPO=${1:-${0:A:h}/../../../..}
OUT=$HOME/.tentacle-lot-mob/builds/android
cd "$REPO/apps/mobile/android"
# google-services.json est ignoré par git : repris du dépôt principal s'il manque.
MAIN_GS="$HOME/Desktop/Projet - local/Tentacle-TV/apps/mobile/android/app/google-services.json"
[[ -f app/google-services.json || ! -f "$MAIN_GS" ]] || cp "$MAIN_GS" app/
# local.properties est ignoré par git : le SDK Android du Mac.
[[ -f local.properties ]] || echo "sdk.dir=${ANDROID_HOME:-$HOME/Library/Android/sdk}" > local.properties
./gradlew --no-daemon -q assembleDebug
./gradlew --stop >/dev/null 2>&1 || true
mkdir -p "$OUT"
cp app/build/outputs/apk/debug/*.apk "$OUT/"
echo "$(date '+%Y-%m-%d %H:%M') $(git -C "$REPO" log -1 --format='%h %s')" > "$OUT/BUILT_FROM.txt"
echo "Android prête : $(ls "$OUT"/*.apk)"
