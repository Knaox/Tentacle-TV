#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Collecte récursive d'une dylib + TOUTES ses dépendances non-système dans un
# dossier de sortie, en réécrivant les install-names en @loader_path (bundle
# self-contained). Généralise bundle-macos-dylibs.sh (qui ne suit que Homebrew)
# pour aussi suivre les libs construites hors Homebrew (ex. notre FFmpeg LGPL).
#
# ⚠️ Les dépendances en `@rpath/…` et `@loader_path/…` se SUIVENT, résolues
# depuis le fichier d'ORIGINE (son dossier, ses LC_RPATH). Le 1.30.0 (1468281)
# les prenait pour du système : le freetype de Homebrew (arm64) tire
# libbrotlidec, qui désigne `@rpath/libbrotlicommon.1.dylib` — absente du
# paquet, plus aucune lecture. Une dépendance introuvable ARRÊTE la collecte.
#
# Usage : collect-dylibs.sh <seed.dylib> <out_dir>
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SEED="$1"
OUT="$2"
mkdir -p "$OUT"

# Seul ce que dyld trouve sur toute machine. PAS les chemins en `@` : ceux-là
# désignent des voisines, à embarquer.
is_system() {
  case "$1" in
    /System/*|/usr/lib/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Les dépendances d'un fichier (son propre nom compris), une par ligne.
deps_of() {
  otool -L "$1" | sed -n -E 's/^[[:space:]]+(.+) \(compatibility version.*$/\1/p'
}

# Les LC_RPATH d'un fichier, un par ligne.
rpaths_of() {
  otool -l "$1" | awk '/cmd LC_RPATH/ { getline; getline; sub(/^ *path /, ""); sub(/ \(offset [0-9]+\)$/, ""); print }'
}

# Chemin réel d'une dépendance `dep` demandée par le fichier `loader` (réel),
# ou rien si dyld ne la trouverait pas.
resolve_dep() {
  local dep="$1" loader="$2" dir candidate rp
  dir="$(dirname "$loader")"
  case "$dep" in
    @loader_path/*) candidate="$dir/${dep#@loader_path/}" ;;
    @rpath/*)
      candidate=""
      while IFS= read -r rp; do
        [ -n "$rp" ] || continue
        rp="${rp/#@loader_path/$dir}"
        if [ -f "$rp/${dep#@rpath/}" ]; then candidate="$rp/${dep#@rpath/}"; break; fi
      done < <(rpaths_of "$loader")
      # Sans LC_RPATH utile : la voisine est d'ordinaire à côté.
      [ -n "$candidate" ] || candidate="$dir/${dep#@rpath/}"
      ;;
    @*) candidate="" ;;          # @executable_path : rien à résoudre ici
    *) candidate="$dep" ;;
  esac
  [ -n "$candidate" ] && [ -f "$candidate" ] && readlink -f "$candidate"
}

# install_name_tool, bavard (« invalidate the code signature ») : on le fait
# taire, mais un échec arrête tout, avec son nom.
rewrite() {
  install_name_tool "$@" 2>/dev/null || { echo "✗ install_name_tool $* a échoué" >&2; exit 1; }
}

# La file porte les chemins d'ORIGINE (réels) : c'est depuis eux que se
# résolvent @loader_path et @rpath — pas depuis la copie dans OUT.
QUEUE="$(mktemp)"; DONE="$(mktemp)"
trap 'rm -f "$QUEUE" "$QUEUE.cur" "$DONE"' EXIT

seed_real="$(readlink -f "$SEED")"
cp -f "$seed_real" "$OUT/$(basename "$seed_real")"
chmod 755 "$OUT/$(basename "$seed_real")"
echo "$seed_real" > "$QUEUE"

while [ -s "$QUEUE" ]; do
  cp "$QUEUE" "$QUEUE.cur"; : > "$QUEUE"
  while IFS= read -r lib; do
    grep -qxF "$lib" "$DONE" 2>/dev/null && continue
    echo "$lib" >> "$DONE"
    own_id="$(otool -D "$lib" | tail -1)"
    while IFS= read -r dep; do
      [ "$dep" = "$own_id" ] && continue
      is_system "$dep" && continue
      real="$(resolve_dep "$dep" "$lib" || true)"
      if [ -z "$real" ]; then
        echo "✗ $(basename "$lib") dépend de $dep, introuvable sur cette machine" >&2
        exit 1
      fi
      name="$(basename "$dep")"
      [ -f "$OUT/$name" ] || { cp -f "$real" "$OUT/$name"; chmod 755 "$OUT/$name"; echo "  + $name"; }
      echo "$real" >> "$QUEUE"
    done < <(deps_of "$lib")
  done < "$QUEUE.cur"
done

# Réécrit install-name (id) + toutes les deps non-système → @loader_path, et
# retire les LC_RPATH : plus rien ne s'y résout, et un `/opt/homebrew` n'a rien
# à faire dans un paquet du Store. `macosDylibs.mjs verify` tranche ensuite.
for dylib in "$OUT"/*.dylib; do
  [ -f "$dylib" ] || continue
  fn="$(basename "$dylib")"
  rewrite -id "@loader_path/$fn" "$dylib"
  while IFS= read -r dep; do
    is_system "$dep" && continue
    name="$(basename "$dep")"
    [ "$dep" = "@loader_path/$name" ] && continue
    if [ -f "$OUT/$name" ]; then rewrite -change "$dep" "@loader_path/$name" "$dylib"; fi
  done < <(deps_of "$dylib")
  while IFS= read -r rp; do
    if [ -n "$rp" ]; then rewrite -delete_rpath "$rp" "$dylib"; fi
  done < <(rpaths_of "$dylib")
  codesign --force --sign - "$dylib" 2>/dev/null || true
done

echo "==> $(ls -1 "$OUT"/*.dylib | wc -l | tr -d ' ') dylibs collectées dans $OUT"
