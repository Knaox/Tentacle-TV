#!/bin/bash
# Construit l'app Apple TV en Release AUTONOME (JS embarqué, sans Metro) et
# l'installe PAR-DESSUS sur une Apple TV physique, sans désinstaller : la
# session et le jumelage restent en place.
#
#   apps/tv/harness/launcher/install-appletv-release.sh            # build complète
#   apps/tv/harness/launcher/install-appletv-release.sh --js-only  # seul le JS a changé
#
# Appareil : « Chambre » par défaut ; autre appareil : APPLETV_DEVICE=<id CoreDevice>
# (liste : xcrun devicectl list devices). Si l'appareil dort (CoreDevice 1011,
# « unavailable »), le réveiller à la télécommande : le Wake-on-LAN est sans effet.
set -euo pipefail
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # chemin à espaces : CocoaPods l'exige
DEVICE="${APPLETV_DEVICE:-DA96352F-A2B7-55A9-86B0-D087B44828B8}"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
IOS="$ROOT/apps/tv/ios"

cd "$ROOT" && pnpm install --frozen-lockfile

if [ "${1:-}" != "--js-only" ]; then
  cd "$IOS" && pod install
  # pod install retouche ces fichiers sans rien changer au fond.
  git checkout -- Podfile.lock TentacleTV.xcodeproj/project.pbxproj TentacleTV/PrivacyInfo.xcprivacy
  cp Podfile.lock Pods/Manifest.lock
  # Hermes Release à la main : le script « Replace Hermes » casse sur l'espace du chemin.
  cd "$IOS/Pods" && rm -rf hermes-engine && mkdir hermes-engine
  tar -xf "$PWD/hermes-engine-artifacts/hermes-ios-0.80.1-release.tar.gz" -C hermes-engine
  # Le script de React Native lit ce marqueur dans Pods/ (son dossier courant),
  # pas dans hermes-engine/ : ailleurs, il réextrairait — et casserait.
  printf Release > .last_build_configuration
fi

cd "$IOS"
xcodebuild -workspace TentacleTV.xcworkspace -scheme TentacleTV -configuration Release \
  -destination 'generic/platform=tvOS' -derivedDataPath build/device-release \
  DEVELOPMENT_TEAM=96K3M57W49 CODE_SIGN_STYLE=Automatic CODE_SIGN_IDENTITY="Apple Development" \
  PROVISIONING_PROFILE_SPECIFIER="" | tail -3

APP="$IOS/build/device-release/Build/Products/Release-appletvos/TentacleTV.app"
xcrun devicectl device install app --device "$DEVICE" "$APP"
xcrun devicectl device process launch --device "$DEVICE" --terminate-existing com.tentacle.mobile
echo "Installée et lancée sur $DEVICE."
# Note : Hermes reste en Release ; avant une build Debug au simulateur, refaire
# l'extraction avec hermes-ios-0.80.1-debug.tar.gz et « printf Debug » (dans Pods/).
