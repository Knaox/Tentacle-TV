#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Build libmpv + FFmpeg en **LGPL** pour macOS (Mac App Store).
#
# Pourquoi : la distribution App Store impose la sandbox + une licence compatible.
# Le bundle Homebrew par défaut est GPL (libx264/libx265 + FFmpeg --enable-gpl) →
# incompatible App Store (cf. VLC retiré). Ce script produit une chaîne **LGPL**
# (sans x264/x265, sans --enable-gpl) : AUCUNE perte de LECTURE (x264/x265 sont des
# ENCODEURS ; le décodage H.264/HEVC/AV1/VP9 reste assuré par les décodeurs LGPL de
# FFmpeg + VideoToolbox matériel). Le FFI Rust (dlopen libmpv.dylib) est inchangé.
#
# Sortie : dylibs LGPL pour l'ARCH HÔTE dans `src-tauri/lib/` (remplace les GPL).
# Pour un binaire UNIVERSAL (Intel + Apple Silicon), la CI lance ce script sur un
# runner arm64 ET un runner x86_64, puis `lipo` les deux jeux (voir
# build-mpv-lgpl-universal.sh / release-appstore.yml).
#
# Usage : bash apps/desktop/scripts/build-mpv-lgpl-macos.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

FFMPEG_TAG="n7.1.1"   # libavcodec 62.x — aligné sur le bundle actuel
MPV_TAG="v0.40.0"     # libmpv 2.x

ARCH="$(uname -m)"    # arm64 | x86_64
ROOT="$(cd "$(dirname "$0")/.." && pwd)"          # apps/desktop
# IMPORTANT : FFmpeg/mpv ne se compilent PAS dans un chemin contenant des espaces
# (le repo est sous « Projet - local »). On build dans /tmp (sans espace) puis on
# copie les dylibs finales dans le repo (collect-dylibs gère les espaces).
WORK="/tmp/tentacle-mpv-lgpl/$ARCH"
PREFIX="$WORK/prefix"
OUT="$ROOT/src-tauri/lib"
export MACOSX_DEPLOYMENT_TARGET=14.0

echo "==> Build LGPL libmpv/FFmpeg ($ARCH) — prefix=$PREFIX"

# 1. Outils de build + dépendances LGPL/BSD (PAS x264/x265 qui sont GPL)
echo "==> Dépendances Homebrew (build tools + libs LGPL/BSD)"
brew install -q meson ninja nasm pkg-config \
  libplacebo dav1d libass freetype fontconfig fribidi harfbuzz libpng little-cms2 \
  libvorbis opus libogg molten-vk 2>/dev/null || true

export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:$(brew --prefix)/lib/pkgconfig"
export PATH="$(brew --prefix)/bin:$PATH"

mkdir -p "$WORK"

# 2. FFmpeg — LGPL (pas de --enable-gpl, pas de --enable-nonfree, pas de x264/x265)
if [ ! -f "$PREFIX/lib/libavcodec.dylib" ]; then
  echo "==> Clone + build FFmpeg $FFMPEG_TAG (LGPL)"
  rm -rf "$WORK/ffmpeg"
  git clone --depth 1 --branch "$FFMPEG_TAG" https://github.com/FFmpeg/FFmpeg.git "$WORK/ffmpeg"
  cd "$WORK/ffmpeg"
  # --disable-lzma : liblzma (xz) est auto-détecté via les deps Homebrew. Apple
  # rejette App Store si libavcodec référence _lzma_code/_lzma_end/_lzma_stream_decoder
  # (« non-public API », cf. rejet Guideline 2.5.1 du 2026-06-17). lzma ne sert qu'au
  # décodage TIFF compressé LZMA dans FFmpeg → aucune perte pour un lecteur vidéo.
  ./configure \
    --prefix="$PREFIX" \
    --arch="$ARCH" \
    --enable-shared --disable-static \
    --disable-programs --disable-doc --disable-debug \
    --disable-gpl --disable-nonfree \
    --disable-lzma \
    --enable-videotoolbox --enable-audiotoolbox \
    --enable-libdav1d
  make -j"$(sysctl -n hw.ncpu)"
  make install
fi

# 3. mpv — LGPL (-Dgpl=false), bibliothèque uniquement
if [ ! -f "$PREFIX/lib/libmpv.dylib" ] && [ ! -f "$PREFIX/lib/libmpv.2.dylib" ]; then
  echo "==> Clone + build mpv $MPV_TAG (LGPL, libmpv)"
  rm -rf "$WORK/mpv"
  git clone --depth 1 --branch "$MPV_TAG" https://github.com/mpv-player/mpv.git "$WORK/mpv"
  cd "$WORK/mpv"
  # Options minimales valides : -Dgpl=false (LGPL), libmpv (lib), pas de CLI.
  # libass / dav1d / etc. sont auto-détectés via pkg-config (deps Homebrew).
  # -Drubberband=disabled : librubberband est GPL (filtre audio) et serait
  # auto-détecté via Homebrew → on l'exclut explicitement (gpl=false ne suffit pas).
  meson setup build \
    --prefix="$PREFIX" \
    --buildtype=release \
    -Dgpl=false \
    -Dlibmpv=true \
    -Dcplayer=false \
    -Drubberband=disabled
  ninja -C build
  ninja -C build install
fi

# 4. Collecte des dylibs (libmpv + FFmpeg + deps non-système) → OUT, @loader_path
#    On VIDE d'abord OUT pour éliminer tout reste de l'ancien bundle GPL (Homebrew
#    libx264/libx265, anciennes versions FFmpeg, etc.).
echo "==> Nettoyage de $OUT (anciennes dylibs GPL) puis collecte LGPL"
rm -f "$OUT"/*.dylib
mkdir -p "$OUT"
# Seed = libmpv réelle (peut être libmpv.2.dylib) ; on la copie aussi sous libmpv.dylib
SEED="$PREFIX/lib/libmpv.dylib"; [ -f "$SEED" ] || SEED="$PREFIX/lib/libmpv.2.dylib"
bash "$ROOT/scripts/collect-dylibs.sh" "$SEED" "$OUT"
# Le FFI macOS dlopen « libmpv.dylib » : assure ce nom (mpv installe libmpv.N.dylib).
if [ ! -f "$OUT/libmpv.dylib" ]; then
  real="$(ls "$OUT"/libmpv.*.dylib 2>/dev/null | head -1)"
  [ -n "$real" ] && cp "$real" "$OUT/libmpv.dylib" && codesign --force --sign - "$OUT/libmpv.dylib"
fi

# 4 bis. MoltenVK : le PILOTE Vulkan, sans lequel rien ne s'affiche en paquet.
#
# ⚠️ `collect-dylibs.sh` ne peut pas le trouver : le chargeur Vulkan
# (`libvulkan.1.dylib`, bien collecté, lui) ne se lie pas à son pilote — il le
# cherche à l'exécution dans un fichier ICD, sous `$(brew --prefix)/etc/vulkan`.
# Hors du bac à sable, ce chemin est inaccessible : le chargeur ne trouve aucun
# périphérique, `gpu-context=macvk` échoue et mpv n'ouvre JAMAIS sa fenêtre. Le
# son sortirait, l'image jamais. Diagnostiqué sur le paquet du 2026-07-30
# (« fenetre mpv introuvable apres 10 s »).
#
# Licence : MoltenVK est sous **Apache 2.0** — compatible App Store, à déclarer
# dans `THIRD-PARTY-LICENSES.md`.
echo "==> MoltenVK (pilote Vulkan) → $OUT"
MOLTEN="$(brew --prefix)/lib/libMoltenVK.dylib"
if [ -f "$MOLTEN" ]; then
  cp -L "$MOLTEN" "$OUT/libMoltenVK.dylib"
  codesign --force --sign - "$OUT/libMoltenVK.dylib" 2>/dev/null || true
  echo "  ✓ libMoltenVK.dylib ($(du -h "$OUT/libMoltenVK.dylib" | cut -f1))"
else
  echo "  ✗ libMoltenVK.dylib introuvable ($MOLTEN) — le paquet n'afficherait aucune image" >&2
  exit 1
fi

# 5. Garde-fou licence : ÉCHEC si une dylib GPL connue est présente.
echo "==> Vérification licence (aucun composant GPL)"
if ls "$OUT" | grep -iqE 'x264|x265|libpostproc|librubberband|libsmbclient'; then
  echo "  ✗ Composant GPL détecté dans $OUT :"
  ls "$OUT" | grep -iE 'x264|x265|libpostproc|librubberband|libsmbclient' | sed 's/^/    /'
  exit 1
fi
echo "  ✓ aucun composant GPL — bundle LGPL OK ($(ls "$OUT"/*.dylib | wc -l | tr -d ' ') dylibs)"

# 6. Garde-fou API non-publique : ÉCHEC si une dylib référence des symboles _lzma_*
#    (Apple rejette l'App Store sinon — Guideline 2.5.1). Couvre une régression où
#    une future dépendance Homebrew réactiverait l'auto-détection lzma.
echo "==> Vérification symboles non-publics (lzma)"
if nm -u "$OUT"/*.dylib 2>/dev/null | grep -q '_lzma_'; then
  echo "  ✗ symboles _lzma_* détectés (API non-publique, rejet App Store) :"
  nm -u "$OUT"/*.dylib 2>/dev/null | grep '_lzma_' | sort -u | sed 's/^/    /'
  exit 1
fi
echo "  ✓ aucun symbole _lzma_*"
