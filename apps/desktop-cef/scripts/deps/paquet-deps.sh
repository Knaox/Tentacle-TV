#!/usr/bin/env bash
# Chaîne de lecture du PAQUET (propriétaire : paquet) : FFmpeg LGPL réduit + libmpv du fork.
#   FFmpeg n9.0.2 (même version que Homebrew), LGPL, sans encodeurs ni muxers, sans OpenSSL
#   (TLS = Secure Transport du système, comme le paquet Electron), sans liblzma (refus App
#   Store, guideline 2.5.1), avec VideoToolbox et dav1d. Liste des composants : ffmpeg-components.sh.
#   Tout vise macOS 14.0 ; les bibliothèques tierces viennent de paquet-libs.sh, jamais de
#   Homebrew (pkg-config limité au préfixe ; zlib et libcurl sont celles du système).
#   libmpv : même fork et mêmes correctifs que mpv-build.sh, sans libarchive, libbluray, zimg,
#   jpeg, X11 (auto-détecté depuis Homebrew), OpenGL (Vulkan seul sert) ; liée à CE FFmpeg.
# Sortie : $CACHE/deps/paquet/prefix/{lib,include,bin} — n'écrase rien de deps/mpv/ (dev).
# Usage : scripts/deps/paquet-deps.sh [--force]   (idempotent ; -j4)
# Variante pour comparer un autre FFmpeg (ex. 7.1.1, celui du paquet Electron) :
#   PAQUET_FFMPEG_TAG=n7.1.1 scripts/deps/paquet-deps.sh → $CACHE/deps/paquet-n7.1.1/prefix,
#   chaîne complète à part (sources des autres bibliothèques clonées depuis deps/paquet).
#   scripts/build.sh --dist lit la même variable.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
FFMPEG_TAG="${PAQUET_FFMPEG_TAG:-n9.0.2}"
root="$cache/deps/paquet${PAQUET_FFMPEG_TAG:+-$PAQUET_FFMPEG_TAG}"
export PAQUET_ROOT="$root"  # lu par paquet-libs.sh
if [[ ! -d "$root/src" && -d "$cache/deps/paquet/src" && "$root" != "$cache/deps/paquet" ]]; then
  # Copies APFS (instantanées) des sources déjà téléchargées, sauf FFmpeg et mpv.
  mkdir -p "$root/src"
  for d in "$cache/deps/paquet/src"/*; do
    case "${d##*/}" in ffmpeg|mpv) ;; *) cp -cR "$d" "$root/src/" ;; esac
  done
fi
prefix="$root/prefix"
ffsrc="$root/src/ffmpeg"
mpvsrc="$root/src/mpv"
MPV_BASE=ab0467ff24c2efc995b2b6e6b50a8b0912d373a6
export MACOSX_DEPLOYMENT_TARGET=14.0
[[ "${1:-}" == "--force" ]] && rm -rf "$prefix" "$root/stamps" "$mpvsrc/build"
mkdir -p "$root/src" "$prefix/lib/pkgconfig" "$root/stamps"
"$here/paquet-libs.sh"
export PKG_CONFIG_LIBDIR="$prefix/lib/pkgconfig" PKG_CONFIG_PATH=""
# zlib et libcurl du système (SDK) : décrites ici pour que pkg-config les trouve sans Homebrew.
sdk="$(xcrun --show-sdk-path)"
for pc in "zlib|zlib compression library|$(sed -n 's/^#define ZLIB_VERSION "\(.*\)"/\1/p' "$sdk/usr/include/zlib.h")|-lz" \
          "libcurl|curl|$(sed -n 's/^#define LIBCURL_VERSION "\(.*\)"/\1/p' "$sdk/usr/include/curl/curlver.h")|-lcurl"; do
  IFS='|' read -r name desc ver libs <<<"$pc"
  printf 'Name: %s\nDescription: %s (système)\nVersion: %s\nLibs: -L/usr/lib %s\nCflags: -I%s/usr/include\n' \
    "$name" "$desc" "$ver" "$libs" "$sdk" >"$prefix/lib/pkgconfig/$name.pc"
done

# --- FFmpeg -------------------------------------------------------------------------------
if [[ ! -d "$ffsrc/.git" ]]; then
  git clone -q --depth 1 --branch "$FFMPEG_TAG" https://github.com/FFmpeg/FFmpeg.git "$ffsrc"
fi
# shellcheck source=ffmpeg-components.sh
source "$here/ffmpeg-components.sh"
if [[ ! -f "$root/stamps/ffmpeg" ]]; then
  cd "$ffsrc"
  make distclean >/dev/null 2>&1 || true
  # --disable-autodetect : rien d'implicite (ni OpenSSL, ni lzma, ni SDL de Homebrew) ;
  # tout ce qui sert est activé nommément.
  ./configure --prefix="$prefix" --arch=arm64 --cc=clang \
    --enable-shared --disable-static --disable-programs --disable-doc --disable-debug \
    --disable-gpl --disable-nonfree --disable-autodetect --disable-everything \
    --enable-videotoolbox --enable-securetransport --enable-zlib --enable-bzlib --enable-iconv \
    --enable-libdav1d \
    --enable-avdevice --enable-avfilter --enable-swscale --enable-swresample \
    "${FFMPEG_COMPONENTS[@]}" \
    --extra-ldflags="-Wl,-dead_strip" --extra-libs=-liconv \
    --pkg-config-flags="--static" >"$root/ffmpeg-configure.log"
  make -j4 >"$root/ffmpeg-build.log"
  make install >/dev/null
  touch "$root/stamps/ffmpeg"
  rm -rf "$mpvsrc/build"  # libmpv suit son FFmpeg
fi

# --- libmpv (fork + correctifs du dépôt) --------------------------------------------------
# Clone local du dépôt de dev (deps/mpv-src n'est pas touché). Une branche par JEU de
# correctifs, comme mpv-build.sh : un correctif ajouté ou modifié reconstruit libmpv.
[[ -d "$mpvsrc/.git" ]] || git clone -q "$cache/deps/mpv-src" "$mpvsrc"
set_id=$(cat "$here"/mpv-patches/*.patch | shasum | cut -c1-8)
cd "$mpvsrc"
if ! git rev-parse -q --verify "paquet-$set_id" >/dev/null; then
  git switch -q -c "paquet-$set_id" "$MPV_BASE"
  git -c user.name=tentacle-cef -c user.email=tentacle-cef@localhost am -q "$here"/mpv-patches/*.patch
fi
git switch -q "paquet-$set_id"
if [[ "$(cat "$root/stamps/mpv-set" 2>/dev/null)" != "$set_id" ]]; then
  rm -rf build && echo "$set_id" >"$root/stamps/mpv-set"
fi
if [[ ! -f build/build.ninja ]]; then
  meson setup build --prefix="$prefix" --buildtype=release -Db_ndebug=true \
    -Dgpl=false -Dlibmpv=true -Dcplayer=true -Dvulkan=enabled -Dcocoa=enabled \
    -Dswift-build=enabled -Dlua=disabled -Djavascript=disabled -Dmanpage-build=disabled \
    -Drubberband=disabled -Dvapoursynth=disabled -Dlibarchive=disabled -Dlibbluray=disabled \
    -Ddvdnav=disabled -Dzimg=disabled -Djpeg=disabled -Dlibavdevice=enabled \
    -Dsdl2-audio=disabled -Dsdl2-video=disabled -Dsdl2-gamepad=disabled \
    -Dcdda=disabled -Duchardet=enabled -Dx11=disabled -Dx11-clipboard=disabled -Dgl=disabled \
    -Dcaca=disabled >"$root/mpv-configure.log"
fi
ninja -C build -j4 >"$root/mpv-build.log"
ninja -C build install >/dev/null

# --- Licences (livrées dans Contents/Resources/licenses par le mode --dist) ----------------
# LGPL (FFmpeg, mpv, libplacebo, fribidi) : texte de la licence et moyen de refaire le build
# (ces scripts, versions et options ci-dessous). MoltenVK : celle de sa formule Homebrew.
lic="$prefix/licenses"; rm -rf "$lic"; mkdir -p "$lic"
s="$root/src"
for pair in "FFmpeg-$FFMPEG_TAG:$s/ffmpeg/COPYING.LGPLv2.1" "mpv:$s/mpv/LICENSE.LGPL" \
  "libplacebo:$s/libplacebo/LICENSE" "libass:$s/libass/COPYING" "harfbuzz:$s/harfbuzz/COPYING" \
  "freetype:$s/freetype/docs/FTL.TXT" "fribidi:$s/fribidi/COPYING" "dav1d:$s/dav1d/COPYING" \
  "lcms2:$s/Little-CMS/LICENSE" "uchardet:$s/uchardet/COPYING" "SDL3:$s/SDL/LICENSE.txt" \
  "Vulkan-Loader:$s/Vulkan-Loader/LICENSE.txt" "glslang:$s/glslang/LICENSE.txt" \
  "MoltenVK:/opt/homebrew/opt/molten-vk/LICENSE"; do
  cp "${pair#*:}" "$lic/${pair%%:*}.txt"
done
printf '%s\n' "Bibliothèques tierces de Tentacle (paquet macOS). Construites par" \
  "scripts/deps/paquet-libs.sh et paquet-deps.sh du dépôt Tentacle CEF (versions, options et" \
  "correctifs y figurent) ; FFmpeg $FFMPEG_TAG en LGPL 2.1, sans composant GPL ni nonfree." \
  "Chromium Embedded Framework / Chromium : CREDITS-Chromium.html." >"$lic/LISEZMOI.txt"

# --- Garde-fous (grep -c : avec pipefail, grep -q coupe le tube et rend un faux négatif) ----
libs=$(find "$prefix/lib" -name '*.dylib' -type f)
if (( $(echo "$libs" | xargs otool -L | grep -c '/opt/homebrew/') > 0 )); then
  echo "une dylib du préfixe dépend de Homebrew" >&2; exit 1
fi
if (( $(echo "$libs" | xargs nm -u 2>/dev/null | grep -c '_lzma_') > 0 )); then
  echo "symboles _lzma_* présents (refus App Store)" >&2; exit 1
fi
for f in $libs; do
  minos=$(otool -l "$f" | awk '/LC_BUILD_VERSION/ {b=1} b && /minos/ {print $2; exit}')
  [[ "$minos" == 14.0 ]] || { echo "$f vise macOS $minos (attendu 14.0)" >&2; exit 1; }
done
grep -q 'CONFIG_GPL 0' "$ffsrc/config.h" || { echo "FFmpeg n'est pas LGPL" >&2; exit 1; }
echo "Chaîne du paquet prête : $prefix"
"$prefix/bin/mpv" --gpu-context=help | grep moltenvk
