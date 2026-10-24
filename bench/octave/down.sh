#!/bin/bash
# Banc Octave — arrête et SUPPRIME le Jellyfin jetable et ses volumes.
#   down.sh            garde les fichiers témoins (partagés avec le Lidarr du banc)
#   down.sh --music    efface aussi le dossier musique du banc
# Ne touche à aucun autre conteneur ; le réseau `octave-bench` reste s'il sert encore.
set -euo pipefail
source "$(dirname "$0")/common.sh"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker volume rm octave-jellyfin-config octave-jellyfin-cache octave-jellyfin-films >/dev/null 2>&1 || true
rm -f "$STATE_DIR/jellyfin.env"
if [ "$(docker network inspect "$NETWORK" -f '{{len .Containers}}' 2>/dev/null || echo x)" = "0" ]; then
  docker network rm "$NETWORK" >/dev/null
fi
if [ "${1:-}" = "--music" ]; then
  case "$MUSIC_DIR" in */.claude/octave/bench-music) rm -rf "$MUSIC_DIR" ;; *) echo "[banc] dossier inattendu, rien effacé" ;; esac
fi
echo "[banc] Jellyfin du banc retiré"
