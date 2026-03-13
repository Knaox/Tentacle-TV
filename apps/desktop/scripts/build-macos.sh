#!/bin/bash
set -euo pipefail

SIGNING_IDENTITY="Developer ID Application: Damien ROUGE (96K3M57W49)"
TARGET="aarch64-apple-darwin"
ENTITLEMENTS="src-tauri/Entitlements.plist"
BUNDLE_DIR="src-tauri/target/$TARGET/release/bundle"
APP_NAME="Tentacle TV"
APP_PATH="$BUNDLE_DIR/macos/$APP_NAME.app"

cd "$(dirname "$0")/.."

# Lire la version depuis tauri.conf.json
VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')
DMG_NAME="${APP_NAME}_${VERSION}_aarch64.dmg"
DMG_PATH="$BUNDLE_DIR/dmg/$DMG_NAME"

# --- 0. Bundler les dépendances Homebrew de libmpv ---
echo "==> [0/9] Bundling dylib dependencies..."
bash "$(dirname "$0")/bundle-macos-dylibs.sh"

# --- 1. Pré-signer toutes les libs ---
echo "==> [1/9] Pre-signing bundled libraries..."
find src-tauri/lib -type f | while read -r lib; do
  codesign --force --options runtime --timestamp \
    --sign "$SIGNING_IDENTITY" "$lib" 2>/dev/null || true
  echo "  Signed: $(basename "$lib")"
done

# --- 2. Build .app seulement (pas de DMG, pas de notarisation Tauri) ---
echo "==> [2/8] Building .app bundle..."
pnpm tauri build --target "$TARGET" --bundles app

# --- 3. Copier les dylibs macOS dans Contents/MacOS/lib/ ---
#     Le plugin libmpv cherche dans exe_dir/lib/ = Contents/MacOS/lib/
echo "==> [3/8] Copying dylibs to Contents/MacOS/lib/..."
mkdir -p "$APP_PATH/Contents/MacOS/lib"
for dylib in "$APP_PATH/Contents/Resources/lib/"*.dylib; do
  [ -f "$dylib" ] || continue
  cp "$dylib" "$APP_PATH/Contents/MacOS/lib/"
  echo "  Copied: $(basename "$dylib")"
done

# --- 4. Signer les dylibs dans MacOS/lib/ ---
echo "==> [4/8] Signing dylibs in bundle..."
for dylib in "$APP_PATH/Contents/MacOS/lib/"*.dylib; do
  [ -f "$dylib" ] || continue
  codesign --force --options runtime --timestamp \
    --sign "$SIGNING_IDENTITY" "$dylib"
  echo "  Signed: $(basename "$dylib")"
done

# --- 5. Re-signer l'app bundle ---
echo "==> [5/8] Re-signing app bundle..."
codesign --force --options runtime --timestamp \
  --sign "$SIGNING_IDENTITY" \
  --entitlements "$ENTITLEMENTS" \
  "$APP_PATH"

# Vérification
codesign --verify --deep --strict "$APP_PATH"
echo "  Signature OK"

# --- 6. Créer le DMG ---
echo "==> [6/8] Creating DMG..."
mkdir -p "$(dirname "$DMG_PATH")"
# Détacher tout volume Tentacle TV monté
hdiutil detach "/Volumes/$APP_NAME" -force 2>/dev/null || true
hdiutil detach "/Volumes/$APP_NAME 1" -force 2>/dev/null || true
rm -f "$DMG_PATH"
hdiutil create -volname "$APP_NAME" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"
codesign --force --sign "$SIGNING_IDENTITY" "$DMG_PATH"

# --- 7. Notariser le DMG ---
echo "==> [7/8] Notarizing DMG (2-5 min)..."
xcrun notarytool submit "$DMG_PATH" \
  --key "$HOME/private_keys/AuthKey_4H8HJVZLC4.p8" \
  --key-id "4H8HJVZLC4" \
  --issuer "b26199c1-bb4e-46fa-82bb-6d21f45b30e6" \
  --wait

# --- 8. Stapler ---
echo "==> [8/8] Stapling notarization ticket..."
xcrun stapler staple "$DMG_PATH"

echo ""
echo "==> Done! $DMG_PATH"
