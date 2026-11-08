#!/usr/bin/env bash
# Mesure de la porte RAM (axe ram) : 3 tours, chacun = une passe de chaque app, ordre tournant
# (pas d'app toujours première après le repos de la machine). Le verrou d'écran du lot doit
# être tenu par l'appelant ; passe.sh attend une session déverrouillée et une charge < 20.
#
#   bench/mesures/porte.sh <dossier de sortie>
#   AVANT=…/Tentacle.app APRES=…/Tentacle.app bench/mesures/porte.sh …
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="$HOME/.cache/tentacle-cef"
export OUT="$1"
AVANT="${AVANT:-$CACHE/build/ram-avant/Tentacle.app}"
APRES="${APRES:-$CACHE/build/ram/Tentacle.app}"
mkdir -p "$OUT"

run() {  # <cef-avant|cef-apres|electron> <n°>
  case "$1" in
    electron) LABEL=electron "$HERE/passe.sh" electron "$2" ;;
    cef-avant) LABEL=cef-avant CEF_APP="$AVANT" CEF_PORT=9311 CEF_PROFILE="$CACHE/profiles/ram-avant" "$HERE/passe.sh" cef "$2" ;;
    cef-apres) LABEL=cef-apres CEF_APP="$APRES" CEF_PORT=9311 CEF_PROFILE="$CACHE/profiles/ram" "$HERE/passe.sh" cef "$2" ;;
  esac
  sleep 8
}

"$HERE/passe.sh" repos 1
run cef-apres 1; run electron 1; run cef-avant 1
run electron 2; run cef-avant 2; run cef-apres 2
run cef-avant 3; run cef-apres 3; run electron 3
python3 "$HERE/synthese.py" "$OUT/resultats.jsonl" > "$OUT/synthese.md"
cat "$OUT/synthese.md"
