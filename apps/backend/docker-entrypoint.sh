#!/bin/sh
# Le point d'entrée de l'image Tentacle (lancé par tini, PID 1).
#
# En root — le cas d'un `docker run` ou d'un compose ordinaire —, il ne garde
# ce droit que le temps de préparer le dossier de données : un volume créé par
# une image d'avant appartient à root. Puis il cède la place au serveur sous
# PUID:PGID (1000:1000 par défaut, l'utilisateur `node` de l'image). Lancé
# directement en non-root (`--user`, Podman sans root), il saute cette marche.
#
# Ce que faisait l'ancienne version et qui n'est plus là :
#  - l'URL de la base lue dans data/database.json : le serveur la lit lui-même ;
#  - `npx prisma generate` à chaque démarrage : le client est généré au build ;
#  - `npx prisma db execute core-init.sql` : le serveur pose son schéma par le
#    client Prisma (services/schemaInit) — la CLI n'est plus dans l'image.
set -eu

DATA_DIR="${TENTACLE_DATA_DIR:-/app/apps/backend/data}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
SERVER="/app/apps/backend/dist/index.js"

# Les dépendances partagées des plugins suivent l'image, même dans un volume ancien.
refresh_shared_deps() {
  mkdir -p "$DATA_DIR/shared-deps"
  if [ -d /app/shared-deps-seed ]; then
    cp -f /app/shared-deps-seed/* "$DATA_DIR/shared-deps/" 2>/dev/null || true
  fi
}

# Un volume d'une image d'avant (root) ou un PUID changé : tout est rendu à
# l'utilisateur du serveur. Rien à faire quand tout lui appartient déjà.
own_data_dir() {
  if [ -n "$(find "$DATA_DIR" \( ! -user "$PUID" -o ! -group "$PGID" \) -print 2>/dev/null | head -n 1)" ]; then
    echo "[Entrypoint] Dossier de données rendu à $PUID:$PGID"
    chown -R "$PUID:$PGID" "$DATA_DIR"
  fi
}

serve() {
  if [ "$(id -u)" = "0" ]; then
    mkdir -p "$DATA_DIR"
    own_data_dir
    # La copie se fait SOUS l'utilisateur du serveur : faite en root, elle
    # rendait les fichiers à root et le chown repassait à chaque démarrage.
    su-exec "$PUID:$PGID" "$0" refresh-shared-deps
    exec su-exec "$PUID:$PGID" node "$SERVER"
  fi
  refresh_shared_deps
  exec node "$SERVER"
}

case "${1:-serve}" in
  serve) serve ;;
  # Le service « init » des piles Docker (stacks/) : secrets de la base et
  # dossiers des médias, avant le premier démarrage — en root, puis il s'arrête
  # (src/cli/stackInit.ts).
  init) exec node /app/apps/backend/dist/cli/stackInit.js ;;
  refresh-shared-deps) refresh_shared_deps ;;
  *) exec "$@" ;;
esac
