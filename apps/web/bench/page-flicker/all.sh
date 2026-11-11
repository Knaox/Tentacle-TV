#!/bin/sh
# Les quatre passes d'un état (sombre et clair × réseau rapide et lent), l'une après l'autre.
#   sh bench/page-flicker/all.sh <étiquette> <base> <fichier de jetons> <dossier de sortie> [options du banc…]
label="$1"; base="$2"; session="$3"; out="$4"; shift 4
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$out"
for theme in dark light; do
  for network in fast slow; do
    node "$here/run.mjs" --base "$base" --session "$session" --theme "$theme" --network "$network" --laps 2 \
      --out "$out/$label-images" --json "$out/$label-$theme-$network.json" "$@" > "$out/$label-$theme-$network.txt" 2>&1
    echo "$label $theme $network : $(tail -1 "$out/$label-$theme-$network.txt")"
  done
done
