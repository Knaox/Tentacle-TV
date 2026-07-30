#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Fusionne deux jeux de dylibs (Apple Silicon ⊕ Intel) en un jeu UNIVERSEL.
#
# Pourquoi deux jeux : mpv et FFmpeg se compilent pour l'architecture de la
# machine qui les compile. La CI lance donc `build-mpv-lgpl-macos.sh` sur un
# runner arm64 ET un runner Intel, et c'est ici que les deux se rejoignent — un
# paquet App Store universel dont une seule dylib serait mono-architecture
# plante au premier film sur l'autre machine, sans que rien ne l'annonce.
#
# Une dylib présente d'un seul côté est recopiée telle quelle : certaines
# dépendances n'existent que sur une architecture, et c'est légitime.
#
# Usage : lipo-libs.sh <lib_arm64> <lib_x64> <sortie>
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ARM="$1"; X64="$2"; OUT="$3"

[ -d "$ARM" ] || { echo "✗ dossier arm64 introuvable : $ARM" >&2; exit 1; }
[ -d "$X64" ] || { echo "✗ dossier x64 introuvable : $X64" >&2; exit 1; }

rm -rf "$OUT"; mkdir -p "$OUT"

fusion=0; solo=0
for lib in "$ARM"/*.dylib; do
  nom="$(basename "$lib")"
  if [ -f "$X64/$nom" ]; then
    lipo -create "$lib" "$X64/$nom" -output "$OUT/$nom"
    fusion=$((fusion + 1))
  else
    cp "$lib" "$OUT/$nom"
    echo "  · $nom : arm64 seul"
    solo=$((solo + 1))
  fi
done

# Le sens inverse : une dylib que seul le côté Intel a produite.
for lib in "$X64"/*.dylib; do
  nom="$(basename "$lib")"
  if [ ! -f "$OUT/$nom" ]; then
    cp "$lib" "$OUT/$nom"
    echo "  · $nom : x86_64 seul"
    solo=$((solo + 1))
  fi
done

[ -f "$OUT/libmpv.2.dylib" ] || { echo "✗ libmpv.2.dylib absente du jeu fusionné" >&2; exit 1; }

echo "==> $fusion dylibs universelles, $solo mono-architecture → $OUT"
lipo -info "$OUT/libmpv.2.dylib"
