#!/usr/bin/env bash
# Banc de compatibilité de la base hors ligne : le cœur d'ELECTRON (packages/offline-core, le
# TypeScript qu'Electron embarque à l'octet près, exécuté par Node) et celui de Tentacle CEF
# jouent le même scénario (scenario.json) ; chacun relit la base de l'autre.
#   A : Electron écrit, Electron et CEF relisent → sorties identiques ;
#   B : CEF écrit, CEF et Electron relisent → sorties identiques ;
#   A et B : mêmes lignes en base, même schéma (racines rendues relatives).
# Usage : bench/offline/compat.sh <exécutable tentacle_offline_compat> [dossier de travail]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cef="${1:?chemin de tentacle_offline_compat}"
work="${2:-$(mktemp -d)}"
rm -rf "$work/a" "$work/b" && mkdir -p "$work/a" "$work/b"
ts() { (cd "$here" && node --no-warnings --experimental-transform-types --import ./ts-resolve.mjs fixture.ts "$@"); }

ts write "$work/a"
ts read "$work/a" "$work/a/electron.json"
"$cef" read "$work/a" "$work/a/cef.json"
echo "A (base écrite par Electron) :"
node "$here/compare.mjs" "$work/a/electron.json" "$work/a/cef.json"

"$cef" write "$work/b"
"$cef" read "$work/b" "$work/b/cef.json"
ts read "$work/b" "$work/b/electron.json"
echo "B (base écrite par CEF) :"
node "$here/compare.mjs" "$work/b/electron.json" "$work/b/cef.json"

echo "A ≡ B (mêmes lignes, même schéma, mêmes réponses) :"
node "$here/compare.mjs" --strip "$work/a" --strip "$work/b" "$work/a/electron.json" "$work/b/cef.json"
