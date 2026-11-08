#!/usr/bin/env bash
# Banc local Tentacle + Jellyfin (colima). Jetable : `reset` efface tout.
#
#   bench/server/banc.sh up       # démarre la pile (127.0.0.1:3471 et :8471)
#   bench/server/banc.sh setup    # joue l'assistant avec des comptes de TEST générés
#   bench/server/banc.sh libs     # (re)crée les bibliothèques, relance l'analyse, redémarre Tentacle (index musique)
#   bench/server/banc.sh status   # état des conteneurs et des deux serveurs
#   bench/server/banc.sh logs     # journaux de Tentacle
#   bench/server/banc.sh down     # arrête (données gardées)
#   bench/server/banc.sh reset    # arrête ET efface volumes + comptes notés
#
# Données hors dépôt : ~/.cache/tentacle-cef/banc/ (comptes.json en 0600).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
BANC="$CACHE/banc"
export MEDIA_PATH="${MEDIA_PATH:-$CACHE/media}"
export DOCKER_HOST="${DOCKER_HOST:-unix://$HOME/.colima/default/docker.sock}"
# Le greffon `docker compose` n'est pas déclaré chez Homebrew : le binaire autonome.
COMPOSE=("${COMPOSE_BIN:-docker-compose}" -f "$HERE/compose.yaml")

mkdir -p "$BANC/logs" "$MEDIA_PATH"

case "${1:-}" in
  up)
    "${COMPOSE[@]}" up -d
    echo "Tentacle : http://127.0.0.1:3471   Jellyfin : http://127.0.0.1:8471"
    ;;
  setup)
    node "$HERE/setup.mjs" "$BANC/comptes.json"
    ;;
  code)
    # Un code d'installation NEUF (celui des journaux ne sert qu'une fois).
    "${COMPOSE[@]}" exec -T tentacle tentacle setup token
    ;;
  libs)
    node "$HERE/setup.mjs" "$BANC/comptes.json" --libs-only
    # L'index musique de Tentacle ne fait un passage complet qu'à SON démarrage
    # (`backend/src/music/index/indexSync.ts`) : des titres déposés après restent
    # en 404 sur /api/music/* tant qu'il n'a pas redémarré.
    sleep 20
    "${COMPOSE[@]}" restart tentacle
    ;;
  status)
    "${COMPOSE[@]}" ps
    curl -fsS http://127.0.0.1:3471/api/setup/status && echo
    curl -fsS http://127.0.0.1:8471/System/Info/Public | head -c 300 && echo
    ;;
  logs)
    "${COMPOSE[@]}" logs --no-color --tail="${2:-200}" tentacle
    ;;
  down)
    "${COMPOSE[@]}" down
    ;;
  reset)
    "${COMPOSE[@]}" down -v
    rm -f "$BANC/comptes.json"
    echo "banc effacé (volumes et comptes)"
    ;;
  *)
    sed -n '2,12p' "$0"
    exit 2
    ;;
esac
