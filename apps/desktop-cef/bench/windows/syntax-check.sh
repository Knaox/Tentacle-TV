#!/usr/bin/env bash
# Compilation À BLANC des sources de l'app pour Windows, depuis macOS (axe windows, lot
# cef-parite) : `clang++ -fsyntax-only` d'Apple ciblant x86_64-w64-mingw32, avec
#   - les en-têtes de mingw-w64 v14.0.0 (archive officielle de GitHub, ~16 Mo, épinglée) ;
#   - la libc++ du SDK d'Apple en configuration Windows (fil Win32, sans disponibilités Apple) ;
#   - les en-têtes CEF de la distribution macOS + les 4 propres à Windows (même commit de CEF,
#     épinglés fichier par fichier) ; SDL3, nlohmann/json, libsodium de Homebrew ; mpv du cache.
# Ce n'est PAS MSVC : ce qui passe ici peut encore échouer chez cl.exe (et inversement pour
# les extensions de mingw) ; c'est le filet qui attrape fautes de frappe, en-têtes manquants,
# API Win32/D3D/DComp mal employées — sans machine Windows ni téléchargement lourd.
#
# Usage : bench/windows/syntax-check.sh [fichier.cpp…]   (sans argument : toute l'app + tests)
# Code de sortie : nombre de fichiers en erreur. Cache : $TENTACLE_CEF_CACHE/deps/windows-check.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
work="$cache/deps/windows-check"
cef_version="$(sed -n 's/^CEF_VERSION="\(.*\)"$/\1/p' "$root/scripts/deps/cef-version.env")"
cef_mac="$cache/deps/cef/$cef_version"
cef_commit="cf671c0"  # le « g… » de la version de CEF (156.0.15+gcf671c0)
mingw_sha256="d71cc644cd5a37c337f2719f3e0c79d89e8d8d5fb9e2952a62d3fa23623dc137"
cef_headers=(
  "include/internal/cef_types_win.h d99eddcbf0419ce3a564f64b9172bf0f1e0ffd182f8eb7f36532aa3a6e3e4435"
  "include/internal/cef_win.h e2d0ea132abbe6a7b69f0f18ba1f5d4423799f3d092d1677941a9bfd0120fc53"
  "include/internal/cef_app_win.h ae97e3b5d394fee92c4f358d3365099ec5a5911265c8aef53fe448005cbfbb5d"
  "include/cef_sandbox_win.h 29f74bd17e8f13dc3679e47f45a7a79e790d2b2ba7213f0dc7d4045e4174e21c"
)

die() { echo "syntax-check : $*" >&2; exit 100; }
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
[[ -f "$cef_mac/include/cef_version.h" ]] || die "CEF macOS absent ($cef_mac) : scripts/deps/fetch-cef.sh"
mkdir -p "$work"

# 1. En-têtes de mingw-w64 (crt + include), _mingw.h généré comme le ferait configure (UCRT, Windows 10).
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

# 2. CEF : les en-têtes de macOS, plus ceux de Windows au même commit.
if [[ ! -f "$work/cef/include/internal/cef_app_win.h" ]]; then
  rm -rf "$work/cef" && mkdir -p "$work/cef" && cp -R "$cef_mac/include" "$work/cef/"
  for entry in "${cef_headers[@]}"; do
    read -r path want <<<"$entry"
    curl -fsSL -o "$work/cef/$path" "https://raw.githubusercontent.com/chromiumembedded/cef/$cef_commit/$path"
    [[ "$(sha "$work/cef/$path")" == "$want" ]] || { rm -rf "$work/cef"; die "CEF $path : empreinte inattendue"; }
  done
fi

# 3. libc++ du SDK, configurée pour Windows.
sdk="$(xcrun --show-sdk-path)"
mkdir -p "$work/libcxx"
sed -e 's/_LIBCPP_HAS_THREAD_API_WIN32 0/_LIBCPP_HAS_THREAD_API_WIN32 1/' \
    -e 's/_LIBCPP_HAS_VENDOR_AVAILABILITY_ANNOTATIONS 1/_LIBCPP_HAS_VENDOR_AVAILABILITY_ANNOTATIONS 0/' \
    -e 's/#define _LIBCPP_PSTL_BACKEND_LIBDISPATCH/#define _LIBCPP_PSTL_BACKEND_SERIAL/' \
    "$sdk/usr/include/c++/v1/__config_site" > "$work/libcxx/__config_site"

brew="$(brew --prefix 2>/dev/null || echo /opt/homebrew)"
mpv_inc="$(ls -d "$cache"/deps/mpv/*/include 2>/dev/null | head -1)"
flags=(-target x86_64-w64-mingw32 -std=c++20 -fsyntax-only -Wall -Wextra -Wno-unused-parameter
  -Wno-missing-field-initializers -Wno-unknown-pragmas -Wno-nonportable-include-path
  -nostdinc -nostdinc++ -isystem "$work/libcxx" -isystem "$sdk/usr/include/c++/v1"
  -isystem "$(clang -print-resource-dir)/include" -isystem "$work/mingw/inc"
  -D_WIN32_WINNT=0x0A00 -DWINVER=0x0A00 -DUNICODE -D_UNICODE -DNOMINMAX -DSODIUM_STATIC
  -I"$work/cef" -I"$root/src" -I"$root/src/bridge" -I"$root/src/display" -I"$root/src/music" -I"$root/src/update"
  -isystem "$brew/opt/nlohmann-json/include" -isystem "$brew/opt/sdl3/include" -isystem "$brew/opt/libsodium/include")
[[ -n "$mpv_inc" ]] && flags+=(-isystem "$mpv_inc")

# 4. Les sources de l'app Windows (ni macOS, ni Linux, ni bancs Linux), et les tests construits sous Windows.
cd "$root"
if (($#)); then
  files=("$@")
else
  files=()  # bash 3.2 de macOS : pas de mapfile
  while IFS= read -r f; do files+=("$f"); done < <(git ls-files 'src/*.cpp' | grep -v -e '/platform/macos/' \
    -e '/platform/linux/' -e '_mac\.' -e 'update/tests/linux_e2e' -e 'update/tests/e2e_feed')
fi
failed=0
for f in "${files[@]}"; do
  if ! out="$(clang++ "${flags[@]}" "$f" 2>&1)" || [[ -n "$out" ]]; then
    echo "=== $f"; echo "$out"
    grep -q "error:" <<<"$out" && failed=$((failed + 1))
  fi
done
echo "syntax-check : ${#files[@]} fichiers, $failed en erreur (cible x86_64-w64-mingw32, pas MSVC)"
exit "$failed"
