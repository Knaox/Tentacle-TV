#!/bin/bash
# Banc Octave — chemins et noms communs (sourcé par up.sh, seed.sh, down.sh…).
# Jamais le Jellyfin réel : dev et prod le partagent. Tout vit ici, jetable.
OCTAVE_ROOT="/Users/damienrouge/Desktop/Projet - local/.claude/octave"
MUSIC_DIR="${OCTAVE_MUSIC_DIR:-$OCTAVE_ROOT/bench-music}"
STATE_DIR="${OCTAVE_STATE_DIR:-$OCTAVE_ROOT/bench-state}"
NETWORK=octave-bench
CONTAINER=octave-jellyfin
IMAGE="${OCTAVE_JELLYFIN_IMAGE:-jellyfin/jellyfin:10.11}"
PORT=8196
JF="http://127.0.0.1:$PORT"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
