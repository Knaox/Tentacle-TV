#!/usr/bin/env bash
# Compilation À BLANC de l'app pour Windows, depuis macOS (axe windows, lot cef-parite) — par
# CMake : l'arbre est CONFIGURÉ comme sous Windows (toolchain-syntax.cmake : WIN32, la sélection
# des sources par OS et les définitions de CHAQUE module, CEF windows64, SDL3 VC, SQLite
# épinglé), puis chaque commande de compile_commands.json est rejouée en -fsyntax-only
# (replay.py). Deux compilateurs, deux bibliothèques standard :
#   (défaut) clang++ d'Apple ciblant x86_64-w64-mingw32 (mingw-clang++.sh) : en-têtes mingw-w64
#            v14.0.0 (archive officielle, ~16 Mo, épinglée), libc++ du SDK en configuration Windows ;
#   --gcc    GCC 12 de mingw-w64 (libstdc++) dans le conteneur du banc croisé de maj
#            (tentacle-cef-maj-cross:bookworm, colima, 2 cœurs), avec les MÊMES en-têtes mingw-w64
#            v14 montés sur ceux du conteneur (v10 : ses en-têtes WinRT ne passent pas GCC).
# Ce n'est PAS MSVC : un filet (fautes, en-têtes manquants, API Win32/D3D/DComp/WinRT), pas un build.
#
# Usage : bench/windows/syntax-check.sh [--gcc] [src/…cpp…]   (sans fichier : tout l'arbre)
# Code de sortie : nombre de commandes en erreur. Téléchargements sous le verrou deps-build.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
export TENTACLE_CEF_CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"  # sqlite.cmake, mingw-clang++.sh
cache="$TENTACLE_CEF_CACHE"
work="$cache/deps/windows-check"
cef_version="$(sed -n 's/^CEF_VERSION="\(.*\)"$/\1/p' "$root/scripts/deps/cef-version.env")"
cef_win="$cache/deps/cef-windows64/$cef_version"
sdl_vc="$cache/deps/sdl3/3.4.16-vc"
mingw_sha256="d71cc644cd5a37c337f2719f3e0c79d89e8d8d5fb9e2952a62d3fa23623dc137"
gcc=0
if [[ "${1:-}" == "--gcc" ]]; then gcc=1; shift; fi

die() { echo "syntax-check : $*" >&2; exit 100; }
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
mkdir -p "$work"

# --- Dépendances (téléchargées une fois, sous le verrou du lot, épinglées) ------------------
lock="$cache/locks/deps-build"
with_lock() {
  mkdir -p "$cache/locks"
  until mkdir "$lock" 2>/dev/null; do
    echo "syntax-check : verrou deps-build pris ($(cat "$lock/owner" 2>/dev/null)), attente…"
    sleep 10
  done
  echo "windows-syntax $$ $(date +%T)" > "$lock/owner"
  trap 'rm -rf "$lock"' EXIT
  "$@"
  rm -rf "$lock"
  trap - EXIT
}
fetch_mingw() {
  local tgz="$work/mingw-w64-v14.0.0.tar.gz" h
  [[ -f "$tgz" ]] || curl -fsSL -o "$tgz" "https://codeload.github.com/mingw-w64/mingw-w64/tar.gz/refs/tags/v14.0.0"
  [[ "$(sha "$tgz")" == "$mingw_sha256" ]] || { rm -f "$tgz"; die "mingw-w64 : empreinte inattendue"; }
  rm -rf "$work/mingw" && mkdir -p "$work/mingw/src" "$work/mingw/inc"
  tar -xzf "$tgz" -C "$work/mingw/src" --include '*/mingw-w64-headers/*'
  h="$(echo "$work"/mingw/src/*/mingw-w64-headers)"
  cp -R "$h/crt/." "$h/include/." "$work/mingw/inc/"
  # _mingw.h comme le générerait configure : UCRT, Windows 10.
  sed -e 's/@DEFAULT_MSVCRT_VERSION@/0xE00/' -e 's/@DEFAULT_WIN32_WINNT@/0xa00/' "$h/crt/_mingw.h.in" > "$work/mingw/inc/_mingw.h"
}
# CEF windows64, SDL3 VC et l'amalgamation SQLite, par le code ÉPINGLÉ du lanceur (scripts/dev).
fetch_windows_deps() {
  node --input-type=module -e "
    const [root, cache, v] = process.argv.slice(1);
    const { CEF_PINS } = await import(root + '/scripts/dev/cef.mjs');
    const { fetchArchive } = await import(root + '/scripts/dev/fetch.mjs');
    const { ensureSdl3, ensureSqlite } = await import(root + '/scripts/dev/windows-deps.mjs');
    const name = 'cef_binary_' + v + '_windows64_minimal';
    await fetchArchive({ url: 'https://cef-builds.spotifycdn.com/' + name.replaceAll('+', '%2B') + '.tar.bz2',
      pin: CEF_PINS.windows64, dest: cache + '/deps/cef-windows64/' + v, inner: name,
      marker: 'include/cef_version.h', sizeHint: CEF_PINS.windows64.size, what: 'CEF windows64' });
    await ensureSdl3();
    await ensureSqlite();" "$root" "$cache" "$cef_version"
}
[[ -f "$work/mingw/inc/_mingw.h" ]] || with_lock fetch_mingw
if [[ ! -f "$cef_win/cmake/FindCEF.cmake" || ! -f "$sdl_vc/cmake/SDL3Config.cmake" ||
      ! -f "$cache/deps/sqlite/sqlite-amalgamation-3460100/sqlite3.c" ]]; then
  with_lock fetch_windows_deps
fi
# libc++ du SDK, configurée pour Windows (fil Win32, sans disponibilités Apple).
sdk="$(xcrun --show-sdk-path)"
mkdir -p "$work/libcxx"
sed -e 's/_LIBCPP_HAS_THREAD_API_WIN32 0/_LIBCPP_HAS_THREAD_API_WIN32 1/' \
    -e 's/_LIBCPP_HAS_VENDOR_AVAILABILITY_ANNOTATIONS 1/_LIBCPP_HAS_VENDOR_AVAILABILITY_ANNOTATIONS 0/' \
    -e 's/#define _LIBCPP_PSTL_BACKEND_LIBDISPATCH/#define _LIBCPP_PSTL_BACKEND_SERIAL/' \
    "$sdk/usr/include/c++/v1/__config_site" > "$work/libcxx/__config_site"
mpv_prefix=""
for d in "$cache"/deps/mpv-win/* "$cache"/deps/mpv/*; do
  if [[ -f "$d/include/mpv/client.h" ]]; then mpv_prefix="$d"; break; fi
done
[[ -n "$mpv_prefix" ]] || die "en-têtes de mpv absents du cache"

# --- Configuration comme sous Windows, puis rejeu ---------------------------------------
if ((gcc)); then
  image=tentacle-cef-maj-cross:bookworm
  docker image inspect "$image" >/dev/null 2>&1 || die "image $image absente : la construire par pnpm test:update:cross"
  case "$root" in "$HOME"/*) ;; *) die "les sources doivent être sous \$HOME (colima ne partage que lui)" ;; esac
  # Les en-têtes mingw-w64 v14 À LA PLACE de ceux du conteneur (sa racine, /usr/x86_64-w64-mingw32/include),
  # plus ses winpthreads (pthread.h…, que libstdc++ « posix » inclut) : une fois.
  gcc_inc="$work/mingw/gcc-inc"
  if [[ ! -f "$gcc_inc/pthread.h" ]]; then
    rm -rf "$gcc_inc" && cp -R "$work/mingw/inc" "$gcc_inc"
    docker run --rm --pull=never "$image" tar -C /usr/x86_64-w64-mingw32/include -cf - \
      pthread.h pthread_compat.h pthread_signal.h pthread_time.h pthread_unistd.h sched.h semaphore.h \
      | tar -C "$gcc_inc" -xf -
  fi
  set +e
  docker run --rm --pull=never --cpus=2 --memory=3g --name "win-syntax-$$" -e TENTACLE_CEF_CACHE=/cache \
    -e FILES="$*" -v "$root:/src:ro" -v "$cef_win:/cef:ro" -v "$sdl_vc:/sdl:ro" -v "$mpv_prefix:/mpv:ro" \
    -v "$cache/deps/sqlite:/cache/deps/sqlite:ro" -v "$gcc_inc:/usr/x86_64-w64-mingw32/include:ro" \
    "$image" bash -c '
      cmake -G Ninja -S /src -B /tmp/b -DCMAKE_TOOLCHAIN_FILE=/src/bench/windows/toolchain-syntax.cmake \
        -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXPORT_COMPILE_COMMANDS=ON -DCEF_ROOT=/cef -DSDL3_DIR=/src/bench/windows/sdl3-syntax -DSDL3_VC_ROOT=/sdl \
        -DMPV_PREFIX=/mpv -DTENTACLE_APP_VERSION=0.0.0 -DCMAKE_MAKE_PROGRAM=/usr/bin/ninja -DCMAKE_C_COMPILER=/usr/bin/x86_64-w64-mingw32-gcc-posix \
        -DCMAKE_CXX_COMPILER=/src/bench/windows/mingw-gcc++.sh -Dnlohmann_json_DIR=/opt/mingw/share/cmake/nlohmann_json \
        -DSODIUM_INCLUDE_DIR=/opt/mingw/include -DSODIUM_LIBRARY=/opt/mingw/lib/libsodium.a \
        > /tmp/cmake.log 2>&1 || { cat /tmp/cmake.log; exit 100; }
      python3 /src/bench/windows/replay.py /tmp/b/compile_commands.json /src --jobs 2 $FILES'
  exit $?
fi
build="$cache/build/windows-syntax-clang"
brew="$(brew --prefix 2>/dev/null || echo /opt/homebrew)"
cmake -G Ninja -S "$root" -B "$build" -DCMAKE_TOOLCHAIN_FILE="$here/toolchain-syntax.cmake" \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXPORT_COMPILE_COMMANDS=ON -DCEF_ROOT="$cef_win" -DSDL3_DIR="$here/sdl3-syntax" -DSDL3_VC_ROOT="$sdl_vc" \
  -DMPV_PREFIX="$mpv_prefix" -DTENTACLE_APP_VERSION=0.0.0 -DCMAKE_MAKE_PROGRAM="$(command -v ninja)" -DCMAKE_C_COMPILER="$here/mingw-clang.sh" \
  -DCMAKE_CXX_COMPILER="$here/mingw-clang++.sh" -Dnlohmann_json_DIR="$brew/share/cmake/nlohmann_json" \
  -DSODIUM_INCLUDE_DIR="$brew/opt/libsodium/include" -DSODIUM_LIBRARY="$brew/opt/libsodium/lib/libsodium.a" \
  > "$build.cmake.log" 2>&1 || { cat "$build.cmake.log"; die "configuration CMake (Windows, clang) refusée"; }
python3 "$here/replay.py" "$build/compile_commands.json" "$root" --jobs 2 "$@"
