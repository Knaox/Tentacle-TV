#!/usr/bin/env bash
# Série de mesures de la chaîne de lecture seule (bench/mesures/mpv_hote.m), sous le verrou
# d'écran du lot, configurations alternées (pas de config toujours première) :
#   bench/lecteur/hote-serie.sh <tours> <fichier> "<étiquette>|<libmpv>|<clé=valeur…>" …
# Une ligne par mesure : `<étiquette> <tour> <sortie de mpv_hote>`. SECS=25 par défaut.
set -uo pipefail
CACHE="$HOME/.cache/tentacle-cef"
HOTE="${HOTE:-$CACHE/build/lecteur/ram/mpv_hote}"
LOCK="$CACHE/locks/ecran"
TOURS="$1"; FILE="$2"; shift 2
until mkdir "$LOCK" 2>/dev/null; do sleep 10; done
echo "lecteur $(date +%H:%M) hote-serie" > "$LOCK/qui"
trap 'rm -f "$LOCK/qui"; rmdir "$LOCK"; echo "verrou rendu $(date +%H:%M:%S)"' EXIT
echo "verrou pris $(date +%H:%M:%S)"
for t in $(seq "$TOURS"); do
  n=$#
  for ((k = 0; k < n; k++)); do
    i=$(( (k + t - 1) % n + 1 ))
    IFS='|' read -r tag lib opts <<< "${!i}"
    # shellcheck disable=SC2086
    out=$("$HOTE" "$lib" "$FILE" "${SECS:-25}" $opts 2>/dev/null | tail -1)
    echo "$tag $t $out"
    sleep 3
  done
done
