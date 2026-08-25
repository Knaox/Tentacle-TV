#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Collecte récursive d'une dylib + TOUTES ses dépendances non-système dans un
# dossier de sortie, en réécrivant les install-names en @loader_path (bundle
# self-contained). Généralise bundle-macos-dylibs.sh (qui ne suit que Homebrew)
# pour aussi suivre les libs construites hors Homebrew (ex. notre FFmpeg LGPL).
#
# Usage : collect-dylibs.sh <seed.dylib> <out_dir>
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SEED="$1"
OUT="$2"
mkdir -p "$OUT"

is_system() {
  case "$1" in
    /System/*|/usr/lib/*|@*) return 0 ;;
    *) return 1 ;;
  esac
}

QUEUE="$(mktemp)"; DONE="$(mktemp)"
trap 'rm -f "$QUEUE" "$DONE"' EXIT

# Copie la seed sous son vrai nom, puis l'amorce.
seed_real="$(readlink -f "$SEED")"
cp -f "$seed_real" "$OUT/$(basename "$seed_real")"
echo "$OUT/$(basename "$seed_real")" > "$QUEUE"

while [ -s "$QUEUE" ]; do
  cp "$QUEUE" "$QUEUE.cur"; > "$QUEUE"
  while IFS= read -r lib; do
    grep -qxF "$lib" "$DONE" 2>/dev/null && continue
    echo "$lib" >> "$DONE"
    [ -f "$lib" ] || continue
    otool -L "$lib" | tail -n +2 | awk '{print $1}' | while IFS= read -r dep; do
      is_system "$dep" && continue
      real="$(readlink -f "$dep" 2>/dev/null || echo "$dep")"
      [ -f "$real" ] || continue
      name="$(basename "$dep")"
      [ -f "$OUT/$name" ] || { cp -f "$real" "$OUT/$name"; chmod 755 "$OUT/$name"; echo "  + $name"; }
      echo "$OUT/$name" >> "$QUEUE"
    done
  done < "$QUEUE.cur"
  rm -f "$QUEUE.cur"
done

# Réécrit install-name (id) + toutes les deps non-système → @loader_path
for dylib in "$OUT"/*.dylib; do
  [ -f "$dylib" ] || continue
  fn="$(basename "$dylib")"
  install_name_tool -id "@loader_path/$fn" "$dylib" 2>/dev/null || true
  otool -L "$dylib" | tail -n +2 | awk '{print $1}' | while IFS= read -r dep; do
    is_system "$dep" && continue
    name="$(basename "$dep")"
    [ -f "$OUT/$name" ] && install_name_tool -change "$dep" "@loader_path/$name" "$dylib" 2>/dev/null || true
  done
  codesign --force --sign - "$dylib" 2>/dev/null || true
done

echo "==> $(ls -1 "$OUT"/*.dylib | wc -l | tr -d ' ') dylibs collectées dans $OUT"
