#!/usr/bin/env bash
# Compilation À BLANC des sources de l'app pour Windows, depuis macOS (axe windows, lot
# cef-parite). Deux compilateurs, deux bibliothèques standard, deux jeux d'en-têtes Win32 :
#   (défaut) clang++ d'Apple ciblant x86_64-w64-mingw32 : en-têtes mingw-w64 v14.0.0 (archive
#            officielle, ~16 Mo, épinglée), libc++ du SDK en configuration Windows ;
#   --gcc    GCC 12 de mingw-w64 (Debian bookworm, libstdc++, en-têtes mingw-w64 v10) dans le
#            conteneur du banc croisé de maj (tentacle-cef-maj-cross:bookworm, colima, 2 cœurs).
# En-têtes de CEF : la distribution windows64 si le lanceur l'a téléchargée
# ($cache/deps/cef-windows64/<version>), sinon ceux de macOS + les 4 propres à Windows au même
# commit (épinglés). SDL3 : le paquet VC si présent, sinon Homebrew. mpv : en-têtes du cache.
# Ce n'est PAS MSVC : ce qui passe ici peut encore échouer chez cl.exe ; c'est le filet qui
# attrape fautes de frappe, en-têtes manquants, API Win32/D3D/DComp mal employées.
#
# Usage : bench/windows/syntax-check.sh [--gcc] [fichier.cpp…]   (sans fichier : app + tests)
# Code de sortie : nombre de fichiers en erreur. Cache : $TENTACLE_CEF_CACHE/deps/windows-check.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
work="$cache/deps/windows-check"
cef_version="$(sed -n 's/^CEF_VERSION="\(.*\)"$/\1/p' "$root/scripts/deps/cef-version.env")"
cef_mac="$cache/deps/cef/$cef_version"
cef_win="$cache/deps/cef-windows64/$cef_version"
cef_commit="cf671c0"  # le « g… » de la version de CEF (156.0.15+gcf671c0)
mingw_sha256="d71cc644cd5a37c337f2719f3e0c79d89e8d8d5fb9e2952a62d3fa23623dc137"
cef_headers=(
  "include/internal/cef_types_win.h d99eddcbf0419ce3a564f64b9172bf0f1e0ffd182f8eb7f36532aa3a6e3e4435"
  "include/internal/cef_win.h e2d0ea132abbe6a7b69f0f18ba1f5d4423799f3d092d1677941a9bfd0120fc53"
  "include/internal/cef_app_win.h ae97e3b5d394fee92c4f358d3365099ec5a5911265c8aef53fe448005cbfbb5d"
  "include/cef_sandbox_win.h 29f74bd17e8f13dc3679e47f45a7a79e790d2b2ba7213f0dc7d4045e4174e21c"
)
gcc=0
if [[ "${1:-}" == "--gcc" ]]; then gcc=1; shift; fi

die() { echo "syntax-check : $*" >&2; exit 100; }
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
mkdir -p "$work"

# En-têtes de CEF : la vraie distribution Windows, sinon macOS + les fichiers de Windows.
if [[ -f "$cef_win/include/cef_version.h" ]]; then
  cef_inc="$cef_win"
else
  [[ -f "$cef_mac/include/cef_version.h" ]] || die "CEF absent ($cef_mac) : scripts/deps/fetch-cef.sh"
  cef_inc="$work/cef"
  if [[ ! -f "$work/cef/include/internal/cef_app_win.h" ]]; then
    rm -rf "$work/cef" && mkdir -p "$work/cef" && cp -R "$cef_mac/include" "$work/cef/"
    for entry in "${cef_headers[@]}"; do
      read -r path want <<<"$entry"
      curl -fsSL -o "$work/cef/$path" "https://raw.githubusercontent.com/chromiumembedded/cef/$cef_commit/$path"
      [[ "$(sha "$work/cef/$path")" == "$want" ]] || { rm -rf "$work/cef"; die "CEF $path : empreinte inattendue"; }
    done
  fi
fi
brew="$(brew --prefix 2>/dev/null || echo /opt/homebrew)"
sdl_inc="$cache/deps/sdl3/3.4.16-vc/include"
[[ -f "$sdl_inc/SDL3/SDL.h" ]] || sdl_inc="$brew/opt/sdl3/include"
mpv_inc=""
for d in "$cache"/deps/mpv-win/*/include "$cache"/deps/mpv/*/include; do
  if [[ -f "$d/mpv/client.h" ]]; then mpv_inc="$d"; break; fi
done
[[ -n "$mpv_inc" ]] || die "en-têtes de mpv absents du cache"

# Les sources de l'app Windows (ni macOS, ni Linux, ni bancs Linux), et les tests construits sous Windows.
cd "$root"
files=()  # bash 3.2 de macOS : pas de mapfile
if (($#)); then
  files=("$@")
else
  while IFS= read -r f; do files+=("$f"); done < <(git ls-files 'src/*.cpp' | grep -v -e '/platform/macos/' \
    -e '/platform/linux/' -e '_mac\.' -e 'update/tests/linux_e2e' -e 'update/tests/e2e_feed')
fi
common=(-std=c++20 -fsyntax-only -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers
  -Wno-unknown-pragmas -D_WIN32_WINNT=0x0A00 -DWINVER=0x0A00 -DUNICODE -D_UNICODE -DNOMINMAX -DSODIUM_STATIC)

if ((gcc)); then
  image=tentacle-cef-maj-cross:bookworm
  docker image inspect "$image" >/dev/null 2>&1 || die "image $image absente : la construire par pnpm test:update:cross"
  # Une liste par exécution : d'autres sessions jouent ce script en même temps.
  list="$(mktemp "$work/files.XXXXXX")"
  trap 'rm -f "$list"' EXIT
  printf '%s\n' "${files[@]}" > "$list"
  # GCC ne connaît pas -Wno-nonportable-include-path ; libstdc++ « posix » (std::thread de mingw).
  set +e
  docker run --rm --pull=never --cpus=2 --memory=2g --name "win-syntax-$$" -e LIST="$(basename "$list")" \
    -v "$root:/src:ro" -v "$cef_inc:/cef:ro" -v "$sdl_inc:/sdl:ro" -v "$mpv_inc:/mpv:ro" -v "$work:/work:ro" \
    "$image" bash -c '
      failed=0; n=0
      while IFS= read -r f; do
        n=$((n + 1))
        mod=""; [[ "$f" =~ ^src/([a-z]+)/tests/ ]] && mod="-I/src/src/${BASH_REMATCH[1]}"
        out="$(x86_64-w64-mingw32-g++-posix "$@" $mod -I/cef -I/src/src -I/src/src/bridge -I/src/src/display \
          -I/src/src/music -I/src/src/update -isystem /sdl -isystem /mpv -isystem /opt/mingw/include \
          "/src/$f" 2>&1)" || true
        if [[ -n "$out" ]]; then echo "=== $f"; echo "$out"; grep -q "error:" <<<"$out" && failed=$((failed + 1)); fi
      done < "/work/$LIST"
      echo "syntax-check : $n fichiers, $failed en erreur (GCC $(x86_64-w64-mingw32-g++-posix -dumpversion), mingw-w64, pas MSVC)"
      exit "$failed"' _ "${common[@]}"
  exit $?  # le code du conteneur : nombre de fichiers en erreur
fi

# Mode clang : en-têtes de mingw-w64 (crt + include), _mingw.h généré comme le ferait configure.
if [[ ! -f "$work/mingw/inc/_mingw.h" ]]; then
  tgz="$work/mingw-w64-v14.0.0.tar.gz"
  [[ -f "$tgz" ]] || curl -fsSL -o "$tgz" "https://codeload.github.com/mingw-w64/mingw-w64/tar.gz/refs/tags/v14.0.0"
  [[ "$(sha "$tgz")" == "$mingw_sha256" ]] || { rm -f "$tgz"; die "mingw-w64 : empreinte inattendue"; }
  rm -rf "$work/mingw" && mkdir -p "$work/mingw/src" "$work/mingw/inc"
  tar -xzf "$tgz" -C "$work/mingw/src" --include '*/mingw-w64-headers/*'
  h="$(echo "$work"/mingw/src/*/mingw-w64-headers)"
  cp -R "$h/crt/." "$h/include/." "$work/mingw/inc/"
  sed -e 's/@DEFAULT_MSVCRT_VERSION@/0xE00/' -e 's/@DEFAULT_WIN32_WINNT@/0xa00/' "$h/crt/_mingw.h.in" > "$work/mingw/inc/_mingw.h"
fi
# libc++ du SDK, configurée pour Windows.
sdk="$(xcrun --show-sdk-path)"
mkdir -p "$work/libcxx"
sed -e 's/_LIBCPP_HAS_THREAD_API_WIN32 0/_LIBCPP_HAS_THREAD_API_WIN32 1/' \
    -e 's/_LIBCPP_HAS_VENDOR_AVAILABILITY_ANNOTATIONS 1/_LIBCPP_HAS_VENDOR_AVAILABILITY_ANNOTATIONS 0/' \
    -e 's/#define _LIBCPP_PSTL_BACKEND_LIBDISPATCH/#define _LIBCPP_PSTL_BACKEND_SERIAL/' \
    "$sdk/usr/include/c++/v1/__config_site" > "$work/libcxx/__config_site"
# mingw-w64 14 : IReference<boolean> et IReference<BYTE> se confondent dans windows.foundation.h
# (touché dès windows.media.h, SMTC de l'axe medias) ; MSVC n'en a pas besoin.
flags=(-target x86_64-w64-mingw32 "${common[@]}" -Wno-nonportable-include-path -D____FIReference_1_boolean_INTERFACE_DEFINED__
  -nostdinc -nostdinc++ -isystem "$work/libcxx" -isystem "$sdk/usr/include/c++/v1"
  -isystem "$(clang -print-resource-dir)/include" -isystem "$work/mingw/inc"
  -I"$cef_inc" -I"$root/src" -I"$root/src/bridge" -I"$root/src/display" -I"$root/src/music" -I"$root/src/update"
  -isystem "$brew/opt/nlohmann-json/include" -isystem "$sdl_inc" -isystem "$brew/opt/libsodium/include"
  -isystem "$mpv_inc")
failed=0
for f in "${files[@]}"; do
  # Les tests d'un module lisent « tests/check.h » depuis la racine de CE module (CMake).
  mod=()
  if [[ "$f" =~ ^src/([a-z]+)/tests/ ]]; then mod=(-I"$root/src/${BASH_REMATCH[1]}"); fi
  if ! out="$(clang++ ${mod[@]+"${mod[@]}"} "${flags[@]}" "$f" 2>&1)" || [[ -n "$out" ]]; then
    echo "=== $f"; echo "$out"
    grep -q "error:" <<<"$out" && failed=$((failed + 1))
  fi
done
echo "syntax-check : ${#files[@]} fichiers, $failed en erreur (clang, cible x86_64-w64-mingw32, pas MSVC)"
exit "$failed"
