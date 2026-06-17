#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Assemble une app macOS UNIVERSELLE (Apple Silicon + Intel) signée Mac App Store.
#
# - lipo du binaire principal + de chaque dylib (arm64 ⊕ x86_64)
# - déplace les dylibs dans Contents/Frameworks (emplacement App Store ; le FFI
#   macOS les y cherche en priorité — cf. mpv_ffi.rs find_lib_path)
# - intègre le provisioning profile (Contents/embedded.provisionprofile)
# - signe inside-out avec « Apple Distribution » + entitlements sandbox
# - productbuild → .pkg signé « 3rd Party Mac Developer Installer »
#
# Usage : package-appstore-universal.sh <app_arm64> <app_x86_64> <profile> "<SIGN_APP>" "<SIGN_PKG>"
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_ARM="$1"; APP_X86="$2"; PROFILE="$3"; SIGN_APP="$4"; SIGN_PKG="$5"; BUILD="${6:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"            # apps/desktop
ENTITLEMENTS="$ROOT/src-tauri/Entitlements.appstore.plist"
UNI="/tmp/appstore/Tentacle TV.app"
PKG="/tmp/appstore/Tentacle-TV.pkg"

rm -rf /tmp/appstore && mkdir -p "$(dirname "$UNI")"
cp -R "$APP_ARM" "$UNI"

BIN="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$UNI/Contents/Info.plist")"

echo "==> lipo binaire principal : $BIN"
lipo -create "$APP_ARM/Contents/MacOS/$BIN" "$APP_X86/Contents/MacOS/$BIN" -output "$UNI/Contents/MacOS/$BIN"

echo "==> lipo dylibs → Contents/Frameworks"
mkdir -p "$UNI/Contents/Frameworks"
for arm_lib in "$APP_ARM/Contents/Resources/lib/"*.dylib; do
  name="$(basename "$arm_lib")"
  x86_lib="$APP_X86/Contents/Resources/lib/$name"
  if [ -f "$x86_lib" ]; then
    lipo -create "$arm_lib" "$x86_lib" -output "$UNI/Contents/Frameworks/$name"
  else
    cp "$arm_lib" "$UNI/Contents/Frameworks/$name"   # dépendance arch-spécifique rare
  fi
done
# Les dylibs ne doivent PAS rester dans Resources (Apple refuse du code en Resources).
rm -rf "$UNI/Contents/Resources/lib"

echo "==> provisioning profile"
cp "$PROFILE" "$UNI/Contents/embedded.provisionprofile"

# Build number (CFBundleVersion) : doit augmenter à chaque upload TestFlight d'une
# même version (sinon Apple refuse le doublon). Fourni par le tag (app-v1.0.0-N).
if [ -n "$BUILD" ]; then
  echo "==> CFBundleVersion = $BUILD"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD" "$UNI/Contents/Info.plist"
fi

echo "==> signature inside-out (dylibs puis app)"
for dylib in "$UNI/Contents/Frameworks/"*.dylib; do
  codesign --force --timestamp --options runtime --sign "$SIGN_APP" "$dylib"
done
codesign --force --timestamp --options runtime \
  --entitlements "$ENTITLEMENTS" \
  --sign "$SIGN_APP" "$UNI"
codesign --verify --deep --strict --verbose=2 "$UNI"

echo "==> productbuild → .pkg"
productbuild --component "$UNI" /Applications --sign "$SIGN_PKG" "$PKG"
cp "$PKG" "$ROOT/../../$(basename "$PKG")" 2>/dev/null || cp "$PKG" "./$(basename "$PKG")"

echo "==> OK : $PKG"
