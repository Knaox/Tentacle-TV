#!/bin/bash
# Banc Octave — AJOUTE un titre au dossier du banc (« Nouvelle venue ») et
# PRÉVIENT Jellyfin (`POST /Library/Media/Updated`, comme Lidarr), pour prouver
# que Tentacle émet `music:library`. `--remove` le retire (et prévient aussi).
#
# Pourquoi prévenir : colima ne propage PAS les évènements inotify de l'hôte vers
# le conteneur (sonde inotifyd du 2026-10-24 : aucun évènement), la surveillance en
# temps réel de Jellyfin ne voit donc rien de ce qui s'écrit depuis le Mac.
set -euo pipefail
source "$(dirname "$0")/common.sh"
set -a; source "$STATE_DIR/jellyfin.env"; set +a
REL="Ensemble Témoin/Arrivée tardive (2026)"
notify() {
  python3 -I -c 'import json,sys;print(json.dumps({"Updates":[{"Path":"/music/"+sys.argv[1],"UpdateType":sys.argv[2]}]}))' "$REL" "$1" \
    | curl -fsS -o /dev/null -X POST "$OCTAVE_JELLYFIN_URL/Library/Media/Updated" \
        -H "X-Emby-Token: $OCTAVE_JELLYFIN_API_KEY" -H 'Content-Type: application/json' -d @-
}
if [ "${1:-}" = "--remove" ]; then rm -rf "$MUSIC_DIR/$REL"; notify Deleted; echo "[banc] titre retiré"; exit 0; fi
"$HERE/seed.sh" --late >/dev/null
notify Created
echo "[banc] « Nouvelle venue » ajouté, Jellyfin prévenu"
