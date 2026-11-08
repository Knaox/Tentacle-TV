#!/usr/bin/env bash
# Bibliothèques du paquet construites depuis les sources, pour macOS 14.0 (propriétaire :
# paquet). Les bouteilles Homebrew visent la version de macOS de la machine (26.0 ici) : une
# fois embarquées, rien ne garantit qu'elles se chargent sur macOS 14 ou 15. Mêmes versions
# que Homebrew, options réduites à ce que mpv et libass utilisent sur macOS :
#   harfbuzz sans glib ni graphite2, freetype sans libpng ni brotli, libass par CoreText
#   (sans fontconfig ni libunibreak), libplacebo par glslang statique (sans shaderc, ni OpenGL),
#   SDL3 réduite à la vidéo et aux évènements (ce que src/ appelle), libsodium statique (maj).
# MoltenVK reste celle de Homebrew : elle vise déjà macOS 12.
# Sortie : $CACHE/deps/paquet/prefix ; marques de fin dans deps/paquet/stamps (idempotent).
# Usage : scripts/deps/paquet-libs.sh   (appelé par paquet-deps.sh ; -j4)
set -euo pipefail
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
root="${PAQUET_ROOT:-$cache/deps/paquet}"  # variante FFmpeg : voir paquet-deps.sh
prefix="$root/prefix"
src="$root/src"
mkdir -p "$src" "$prefix" "$root/stamps" "$root/logs"
export MACOSX_DEPLOYMENT_TARGET=14.0  # lu par clang : -mmacosx-version-min par défaut
export PKG_CONFIG_LIBDIR="$prefix/lib/pkgconfig"  # rien de Homebrew ne doit être trouvé
export PKG_CONFIG_PATH=""

fetch() {  # fetch <dépôt GitHub> <étiquette> [--recursive] → dossier source
  local d="$src/${1##*/}"
  [[ -d "$d" ]] || git -c advice.detachedHead=false clone -q --depth 1 --branch "$2" ${3:-} \
    "https://github.com/$1.git" "$d"
  echo "$d"
}
meson_lib() {  # meson_lib <nom> <source> [options meson…]
  local n="$1" d="$2"; shift 2
  [[ -f "$root/stamps/$n" ]] && return
  echo "== $n" >&2
  rm -rf "$d/build-paquet"
  meson setup "$d/build-paquet" "$d" --prefix="$prefix" --libdir=lib --buildtype=release \
    -Ddefault_library=shared -Db_ndebug=true -Dcmake_prefix_path="$prefix" "$@" \
    >"$root/logs/$n.log" 2>&1
  ninja -C "$d/build-paquet" -j4 >>"$root/logs/$n.log" 2>&1
  ninja -C "$d/build-paquet" install >>"$root/logs/$n.log" 2>&1
  touch "$root/stamps/$n"
}
cmake_lib() {  # cmake_lib <nom> <source> [options cmake…]
  local n="$1" d="$2"; shift 2
  [[ -f "$root/stamps/$n" ]] && return
  echo "== $n" >&2
  rm -rf "$d/build-paquet"
  cmake -G Ninja -S "$d" -B "$d/build-paquet" -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$prefix" -DCMAKE_INSTALL_LIBDIR=lib -DCMAKE_PREFIX_PATH="$prefix" \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=14.0 -DCMAKE_INSTALL_NAME_DIR="$prefix/lib" "$@" \
    >"$root/logs/$n.log" 2>&1
  ninja -C "$d/build-paquet" -j4 >>"$root/logs/$n.log" 2>&1
  ninja -C "$d/build-paquet" install >>"$root/logs/$n.log" 2>&1
  touch "$root/stamps/$n"
}

meson_lib dav1d "$(fetch videolan/dav1d 1.5.4)" -Denable_tools=false -Denable_tests=false \
  -Denable_examples=false -Denable_docs=false
meson_lib lcms2 "$(fetch mm2/Little-CMS lcms2.19.1)" -Djpeg=disabled -Dtiff=disabled -Dutils=false \
  -Dtests=disabled
# uchardet : pas de miroir GitHub ; la source est celle de la formule Homebrew (brew fetch -s).
if [[ ! -d "$src/uchardet" ]]; then
  brew fetch -q -s uchardet >/dev/null
  mkdir -p "$src/uchardet" && tar -xJf "$(brew --cache -s uchardet)" -C "$src/uchardet" --strip-components=1
fi
cmake_lib uchardet "$src/uchardet" -DBUILD_BINARY=OFF -DBUILD_STATIC=OFF -DCMAKE_POLICY_VERSION_MINIMUM=3.5
meson_lib fribidi "$(fetch fribidi/fribidi v1.0.17)" -Ddocs=false -Dbin=false -Dtests=false
meson_lib freetype "$(fetch freetype/freetype VER-2-15-0)" -Dpng=disabled -Dbrotli=disabled \
  -Dbzip2=disabled -Dharfbuzz=disabled -Dzlib=system -Dtests=disabled
meson_lib harfbuzz "$(fetch harfbuzz/harfbuzz 14.5.1)" -Dglib=disabled -Dgobject=disabled \
  -Dcairo=disabled -Dchafa=disabled -Dicu=disabled -Dgraphite=disabled -Dgraphite2=disabled \
  -Dfreetype=enabled -Dcoretext=disabled -Dsubset=disabled -Draster=disabled -Dvector=disabled \
  -Dgpu=disabled -Dtests=disabled -Ddocs=disabled -Dutilities=disabled -Dintrospection=disabled \
  -Dbenchmark=disabled
meson_lib libass "$(fetch libass/libass 0.17.5)" -Dfontconfig=disabled -Dcoretext=enabled \
  -Ddirectwrite=disabled -Dlibunibreak=disabled -Drequire-system-font-provider=true -Dtest=disabled \
  -Dcompare=disabled -Dprofile=disabled -Dfuzz=disabled -Dcheckasm=disabled
cmake_lib vulkan-headers "$(fetch KhronosGroup/Vulkan-Headers v1.4.357)" -DVULKAN_HEADERS_ENABLE_MODULE=OFF
cmake_lib vulkan-loader "$(fetch KhronosGroup/Vulkan-Loader v1.4.357)" -DBUILD_TESTS=OFF \
  -DVulkanHeaders_DIR="$prefix/share/cmake/VulkanHeaders"
# glslang statique (sans optimiseur SPIRV-Tools), lié DANS libplacebo.
cmake_lib glslang "$(fetch KhronosGroup/glslang vulkan-sdk-1.4.357.0)" -DBUILD_SHARED_LIBS=OFF \
  -DENABLE_OPT=OFF -DGLSLANG_TESTS=OFF -DENABLE_GLSLANG_BINARIES=OFF -DENABLE_HLSL=OFF \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON
# Leur meson cherche libglslang.a et ses limites par défaut sans les dossiers du SDK : on les
# lui donne (sed idempotent, -I pour le test d'en-tête en C, bibliothèque passée au lien).
pl="$(fetch haasn/libplacebo v7.360.1 --recursive)"
sed -i '' "s/find_library('glslang', required: required, static: static)/find_library('glslang', required: required, static: static, dirs: vulkan_lib_dirs)/" \
  "$pl/src/glsl/meson.build"
meson_lib libplacebo "$pl" -Dvulkan=enabled \
  -Dvulkan-registry="$prefix/share/vulkan/registry/vk.xml" -Dglslang=enabled -Dshaderc=disabled \
  -Dvulkan-sdk="$prefix" -Dc_args="-I$prefix/include" -Dcpp_args="-I$prefix/include" \
  -Dcpp_link_args="$prefix/lib/libglslang-default-resource-limits.a" \
  -Dlcms=enabled -Dopengl=disabled -Dd3d11=disabled -Ddovi=enabled -Dlibdovi=disabled \
  -Ddemos=false -Dtests=false -Dbench=false -Dfuzz=false -Dunwind=disabled -Dxxhash=disabled
# libsodium (assistant et moteur de mise à jour, lien STATIQUE) : celle de Homebrew vise 26.0.
# Source de la formule (tarball avec configure), comme uchardet.
if [[ ! -f "$root/stamps/libsodium" ]]; then
  echo "== libsodium" >&2
  brew fetch -q -s libsodium >/dev/null
  rm -rf "$src/libsodium" && mkdir -p "$src/libsodium"
  tar -xzf "$(brew --cache -s libsodium)" -C "$src/libsodium" --strip-components=1
  (cd "$src/libsodium" && ./configure --prefix="$prefix" --disable-shared --enable-static \
     --disable-dependency-tracking && make -j4 && make install) >"$root/logs/libsodium.log" 2>&1
  touch "$root/stamps/libsodium"
fi
# Sans compilateur GLSL, libplacebo se construit quand même mais Vulkan ne rend rien : refuser.
if (( $(grep -c 'Building without any GLSL compiler' "$root/logs/libplacebo.log") > 0 )); then
  rm -f "$root/stamps/libplacebo"; echo "libplacebo sans glslang" >&2; exit 1
fi
cmake_lib sdl3 "$(fetch libsdl-org/SDL release-3.4.16)" -DSDL_SHARED=ON -DSDL_STATIC=OFF \
  -DSDL_TESTS=OFF -DSDL_EXAMPLES=OFF -DSDL_AUDIO=OFF -DSDL_CAMERA=OFF -DSDL_JOYSTICK=OFF \
  -DSDL_HAPTIC=OFF -DSDL_HIDAPI=OFF -DSDL_SENSOR=OFF -DSDL_GPU=OFF -DSDL_RENDER=OFF \
  -DSDL_OPENGL=OFF -DSDL_OPENGLES=OFF -DSDL_VULKAN=OFF
echo "Bibliothèques du paquet prêtes (macOS 14.0) : $prefix"
