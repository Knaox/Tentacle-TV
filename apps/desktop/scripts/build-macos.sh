#!/bin/bash
set -euo pipefail

SIGNING_IDENTITY="Developer ID Application: Damien ROUGE (96K3M57W49)"

cd "$(dirname "$0")/.."

# --- 1. Pré-signer les dylibs sources avec Developer ID + hardened runtime + timestamp ---
echo "==> Pre-signing dylibs in src-tauri/lib/..."
for dylib in src-tauri/lib/*.dylib; do
  [ -f "$dylib" ] || continue
  codesign --force --options runtime --timestamp \
    --sign "$SIGNING_IDENTITY" \
    "$dylib"
  echo "  Signed: $(basename "$dylib")"
done

# Vérification rapide
echo "==> Verifying dylib signatures..."
for dylib in src-tauri/lib/*.dylib; do
  [ -f "$dylib" ] || continue
  codesign --verify --strict "$dylib"
  echo "  OK: $(basename "$dylib")"
done

# --- 2. Build + notarisation automatique Tauri ---
echo "==> Building Tauri app (sign + notarize)..."
export APPLE_API_KEY="4H8HJVZLC4"
export APPLE_API_ISSUER="b26199c1-bb4e-46fa-82bb-6d21f45b30e6"
export APPLE_API_KEY_PATH="$HOME/private_keys/AuthKey_4H8HJVZLC4.p8"

pnpm tauri build --target aarch64-apple-darwin

echo ""
echo "==> Done!"
