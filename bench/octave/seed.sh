#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# Banc Octave — génère les fichiers témoins dans le dossier musique PARTAGÉ
# (idempotent : un album déjà écrit n'est pas refait). Son synthétique, aucun
# contenu protégé ; tags MusicBrainz et ReplayGain (seed/catalog.py).
#
#   seed.sh            la bibliothèque témoin
#   seed.sh --late     le titre « Nouvelle venue » seul (preuve des événements)
#
# Outils : ffmpeg (Homebrew) ; mutagen 1.47.0 dans un venv du dossier d'état.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
source "$(dirname "$0")/common.sh"
mkdir -p "$MUSIC_DIR" "$STATE_DIR"
VENV="$STATE_DIR/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet "mutagen==1.47.0"
fi
PYTHONDONTWRITEBYTECODE=1 "$VENV/bin/python" -I "$HERE/seed/generate.py" "$MUSIC_DIR" "$@"
