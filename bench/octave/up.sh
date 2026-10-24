#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# Banc Octave — le Jellyfin JETABLE du lot (jamais le Jellyfin réel : dev et
# prod le partagent). Idempotent : relancer ne recrée rien.
#
#   up.sh
#
# - réseau Docker `octave-bench` (partagé avec le Lidarr du banc de Sillon) ;
# - fichiers témoins (seed.sh) s'il n'y en a pas encore ;
# - conteneur `octave-jellyfin`, 127.0.0.1:8196, dossier musique monté en
#   lecture seule sur /music (Lidarr y écrit, Jellyfin le lit) ;
# - assistant, clé d'API, bibliothèques, comptes : jellyfin_setup.py ;
# - état (clé, ids, jetons, mots de passe du banc) : $STATE_DIR/jellyfin.env (0600).
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
source "$(dirname "$0")/common.sh"
mkdir -p "$STATE_DIR" "$MUSIC_DIR"
colima status >/dev/null 2>&1 || colima start
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null

count_audio() {
  find "$MUSIC_DIR" -type f \( -iname '*.flac' -o -iname '*.m4a' -o -iname '*.opus' -o -iname '*.mp3' \
    -o -iname '*.wav' -o -iname '*.dsf' -o -iname '*.ogg' -o -iname '*.aac' \) | wc -l | tr -d ' '
}
[ "$(count_audio)" -gt 0 ] || "$HERE/seed.sh"

if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker start "$CONTAINER" >/dev/null
else
  docker run -d --name "$CONTAINER" --network "$NETWORK" --network-alias octave-jellyfin \
    -p "127.0.0.1:$PORT:8096" \
    -e TZ=Europe/Paris \
    -v octave-jellyfin-config:/config -v octave-jellyfin-cache:/cache -v octave-jellyfin-films:/films \
    -v "$MUSIC_DIR:/music:ro" \
    --label app.tentacletv.bench=octave \
    "$IMAGE" >/dev/null
fi
python3 -I "$HERE/jellyfin_setup.py" "$JF" "$STATE_DIR" "$(count_audio)"
echo "[banc] état : $STATE_DIR/jellyfin.env — interface web : $JF (admin / voir README)"
