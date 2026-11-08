#!/usr/bin/env bash
# Construit libmpv pour le prototype (propriétaire : vidéo-HDR).
#   base    : fork de la référence andrewrabert/mpv, branche jellium-desktop (ab0467ff24)
#   + nos correctifs : scripts/deps/mpv-patches/*.patch (contexte `moltenvk` : mpv dessine dans
#     une CAMetalLayer fournie par l'hôte, --wid = la couche, --moltenvk-surface-size)
#   dépendances : Homebrew (ffmpeg, libplacebo, molten-vk, vulkan-loader, libass…)
#   build LGPL (-Dgpl=false), sans lua/js, avec le binaire `mpv` (témoin natif macvk).
#   0002 (lecteur) : un changement de piste audio/sous-titres ne vide plus le cache du démuxeur.
#   0003 (lecteur) : une bascule audio en lecture ne fige plus l'image (délai A/V recalé).
# Sortie : $CACHE/deps/mpv/<sha8 du commit construit>/{lib,include,bin}. Le sha est
# REPRODUCTIBLE (base + correctifs, dates d'auteur) : src/player/CMakeLists.txt le connaît.
# Usage : scripts/deps/mpv-build.sh   (idempotent ; ninja -j4)
#   MPV_SRC=<clone> : un autre clone que $CACHE/deps/mpv-src (essais d'un axe, sans toucher
#   au clone partagé).
set -euo pipefail

CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
SRC="${MPV_SRC:-$CACHE/deps/mpv-src}"
BASE=ab0467ff24c2efc995b2b6e6b50a8b0912d373a6
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$SRC/.git" ]; then
  git clone --branch jellium-desktop https://github.com/andrewrabert/mpv "$SRC"
fi
cd "$SRC"
# Une branche par JEU de correctifs : en ajouter un en reconstruit une autre, sans réécrire
# celle d'avant (`tentacle-cef` = le seul 0001, sha b5c712f4, garde son préfixe).
SET=$(cat "$HERE"/mpv-patches/*.patch | shasum | cut -c1-8)
BRANCH="tentacle-cef-$SET"
if ! git rev-parse -q --verify "$BRANCH" >/dev/null; then
  git switch -q -c "$BRANCH" "$BASE"
  git -c user.name=tentacle-cef -c user.email=tentacle-cef@localhost am -q --committer-date-is-author-date \
    "$HERE"/mpv-patches/*.patch
fi
git switch -q "$BRANCH"
SHA=$(git rev-parse --short=8 HEAD)
PREFIX="$CACHE/deps/mpv/$SHA"

export PKG_CONFIG_PATH="/opt/homebrew/lib/pkgconfig:/opt/homebrew/opt/libarchive/lib/pkgconfig"
if [ ! -f build/build.ninja ]; then
  meson setup build --prefix="$PREFIX" --buildtype=release -Dgpl=false -Dlibmpv=true \
    -Dcplayer=true -Dvulkan=enabled -Dcocoa=enabled -Dswift-build=enabled -Dlua=disabled \
    -Djavascript=disabled -Dmanpage-build=disabled -Drubberband=disabled -Dvapoursynth=disabled
else
  meson configure build --prefix="$PREFIX" >/dev/null
fi
ninja -C build -j4
ninja -C build install >/dev/null
echo "libmpv prête : $PREFIX"
"$PREFIX/bin/mpv" --gpu-context=help | grep moltenvk
