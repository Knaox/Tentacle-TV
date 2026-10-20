#!/bin/zsh
# Construit l'app iOS de DÉVELOPPEMENT (simulateur, Debug, sans bundle JS : elle
# lit celui de Metro) depuis le dépôt où vit ce script, et la dépose dans
# ~/.tentacle-lot-mob/builds/ios/ pour tout le lot. À lancer par le verrou :
#   ~/.tentacle-lot-mob/heavy.sh wt-banc zsh apps/server-e2e/wt-bench/devices/build-ios.sh
set -euo pipefail
# Premier argument facultatif : le dépôt (worktree) à construire — par défaut celui du script.
REPO=${1:-${0:A:h}/../../../..}
OUT=$HOME/.tentacle-lot-mob/builds/ios
DD=$HOME/.tentacle-lot-mob/dd-ios
cd "$REPO/apps/mobile/ios"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
# Les pods suivent le Podfile.lock du dépôt construit (une branche native peut l'avoir changé).
pod install
# arm64 seul : MPVKit n'a pas de tranche x86_64 (le lien échoue sinon).
xcodebuild -workspace TentacleTV.xcworkspace -scheme TentacleTV -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO ARCHS=arm64 ONLY_ACTIVE_ARCH=NO -quiet build
APP=$DD/Build/Products/Debug-iphonesimulator/TentacleTV.app
mkdir -p "$OUT"
rsync -a --delete "$APP" "$OUT/"
echo "$(date '+%Y-%m-%d %H:%M') $(git -C "$REPO" log -1 --format='%h %s')" > "$OUT/BUILT_FROM.txt"
echo "iOS prête : $OUT/TentacleTV.app"
