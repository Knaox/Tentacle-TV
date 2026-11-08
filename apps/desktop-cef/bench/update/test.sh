#!/usr/bin/env bash
# pnpm test:update — tests hors ligne de la mise à jour : la règle et le moteur (C++, sans
# CEF ni réseau), la surcouche (node --test), l'assistant de remplacement sur des paquets
# factices (macOS), et la syntaxe du code Linux (clang, en-tête de substitution) ; Linux et Windows pour de vrai :
# bench/update/cross-test.sh (pnpm test:update:cross, conteneur Debian). Construit dans $TENTACLE_CEF_CACHE/build/maj-tests.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
build="$cache/build/maj-tests"

echo "== règle et moteur (C++)"
if [[ ! -f "$build/build.ninja" ]]; then
  cmake -G Ninja -S "$root/src/update" -B "$build" -DCMAKE_BUILD_TYPE=Debug >/dev/null
fi
ninja -C "$build" -j4 >/dev/null
# Les journaux du moteur vont sur stderr : montrés seulement en cas d'échec (contre-exemples).
"$build/tentacle_update_tests" 2>"$build/tests.err" || { grep -v '^\[maj\]' "$build/tests.err"; exit 1; }

echo "== surcouche (node --test)"
node --test "$root/bench/update/overlay.test.mjs" 2>&1 | grep -E "^ℹ (tests|pass|fail)"

if [[ "$(uname)" == "Darwin" ]]; then
  echo "== assistant de remplacement (paquets factices, sans fenêtre)"
  "$root/bench/update/helper-test.sh" "$build/tentacle-update" | tail -1
  echo "== Linux : syntaxe ici (construit, testé et parcouru : pnpm test:update:cross)"
  shim="$build/linux_shim.h"
  printf '#pragma once\n#define RENAME_EXCHANGE 2\nstatic inline int renameat2(int, const char*, int, const char*, unsigned) { return -1; }\n' >"$shim"
  clang++ -std=c++20 -fsyntax-only -Wall -Wextra -Wno-unused-parameter -include "$shim" \
    -I"$root/src" -I/opt/homebrew/include -I/opt/homebrew/opt/libsodium/include \
    "$root/src/platform/linux/update_linux.cpp" && echo "update_linux.cpp : syntaxe OK"
  echo "== Windows : compilé et lié par mingw-w64 dans pnpm test:update:cross (jamais exécuté)"
fi
