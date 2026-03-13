#!/bin/bash
set -euo pipefail

# Bundle toutes les dépendances Homebrew de libmpv dans src-tauri/lib/
# et réécrit les chemins pour utiliser @loader_path/ (self-contained)

LIB_DIR="$(cd "$(dirname "$0")/../src-tauri/lib" && pwd)"
QUEUE_FILE="$(mktemp)"
DONE_FILE="$(mktemp)"
trap 'rm -f "$QUEUE_FILE" "$DONE_FILE"' EXIT

echo "==> Bundling Homebrew dependencies into $LIB_DIR"
echo ""

# --- Étape 1 : Collecter et copier toutes les dépendances récursivement ---
echo "--- Collecting dependencies ---"

# Seed: libmpv.dylib
echo "$LIB_DIR/libmpv.dylib" > "$QUEUE_FILE"
> "$DONE_FILE"

while [ -s "$QUEUE_FILE" ]; do
  # Lire la file d'attente actuelle
  cp "$QUEUE_FILE" "${QUEUE_FILE}.processing"
  > "$QUEUE_FILE"

  while IFS= read -r lib_path; do
    # Skip si déjà traité
    if grep -qxF "$lib_path" "$DONE_FILE" 2>/dev/null; then
      continue
    fi
    echo "$lib_path" >> "$DONE_FILE"

    [ -f "$lib_path" ] || continue

    # Extraire les dépendances Homebrew
    deps="$(otool -L "$lib_path" 2>/dev/null | tail -n +2 | awk '{print $1}' | grep '^/opt/homebrew/' || true)"

    for dep_path in $deps; do
      # Résoudre le chemin réel
      real_path="$(readlink -f "$dep_path" 2>/dev/null || echo "$dep_path")"
      [ -f "$real_path" ] || continue

      dep_name="$(basename "$dep_path")"

      # Copier dans lib/ si pas déjà présent
      if [ ! -f "$LIB_DIR/$dep_name" ]; then
        cp "$real_path" "$LIB_DIR/$dep_name"
        chmod 755 "$LIB_DIR/$dep_name"
        echo "  Copied: $dep_name"
      fi

      # Ajouter à la file pour traitement
      if ! grep -qxF "$real_path" "$DONE_FILE" 2>/dev/null; then
        echo "$real_path" >> "$QUEUE_FILE"
      fi
      # Aussi traiter la copie locale
      if ! grep -qxF "$LIB_DIR/$dep_name" "$DONE_FILE" 2>/dev/null; then
        echo "$LIB_DIR/$dep_name" >> "$QUEUE_FILE"
      fi
    done
  done < "${QUEUE_FILE}.processing"
  rm -f "${QUEUE_FILE}.processing"
done

# --- Étape 2 : Réécrire tous les chemins ---
echo ""
echo "--- Rewriting library paths ---"

for dylib in "$LIB_DIR"/*.dylib; do
  [ -f "$dylib" ] || continue
  filename="$(basename "$dylib")"

  # Réécrire l'install name
  old_id="$(otool -D "$dylib" | tail -1)"
  if [[ "$old_id" != "@loader_path/"* ]] && [[ "$old_id" != "@rpath/"* ]]; then
    install_name_tool -id "@loader_path/$filename" "$dylib" 2>/dev/null || true
  fi

  # Réécrire chaque dépendance
  otool -L "$dylib" | tail -n +2 | awk '{print $1}' | while IFS= read -r dep_path; do
    # Skip système et déjà réécrit
    [[ "$dep_path" == /System/* ]] && continue
    [[ "$dep_path" == /usr/lib/* ]] && continue
    [[ "$dep_path" == "@loader_path/"* ]] && continue
    [[ "$dep_path" == "@rpath/"* ]] && continue

    dep_name="$(basename "$dep_path")"
    if [ -f "$LIB_DIR/$dep_name" ]; then
      install_name_tool -change "$dep_path" "@loader_path/$dep_name" "$dylib" 2>/dev/null || true
    fi
  done

  echo "  Rewritten: $filename"
done

# --- Étape 3 : Vérification ---
echo ""
echo "--- Verification ---"
ERRORS=0
for dylib in "$LIB_DIR"/*.dylib; do
  [ -f "$dylib" ] || continue
  filename="$(basename "$dylib")"
  remaining="$(otool -L "$dylib" | tail -n +2 | awk '{print $1}' | grep '/opt/homebrew/' || true)"
  if [ -n "$remaining" ]; then
    echo "WARNING: $filename still references:"
    echo "$remaining" | sed 's/^/  /'
    ERRORS=$((ERRORS + 1))
  fi
done

TOTAL=$(ls -1 "$LIB_DIR"/*.dylib 2>/dev/null | wc -l | tr -d ' ')
SIZE=$(du -sh "$LIB_DIR" | awk '{print $1}')

if [ "$ERRORS" -eq 0 ]; then
  echo "All $TOTAL libraries are self-contained! ($SIZE total)"
else
  echo ""
  echo "WARNING: $ERRORS libraries still have external references."
fi

echo ""
echo "==> Done!"
