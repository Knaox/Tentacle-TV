#!/bin/sh
# `tentacle` — la commande de la machine (`tentacle setup token|reset`).
#
# `docker compose exec` entre en root : la commande repasse au compte du
# serveur (PUID:PGID), sinon le code qu'elle écrit dans le volume serait
# illisible pour lui.
set -eu
CLI="/app/apps/backend/dist/cli/tentacle.js"
if [ "$(id -u)" = "0" ]; then
  exec su-exec "${PUID:-1000}:${PGID:-1000}" node "$CLI" "$@"
fi
exec node "$CLI" "$@"
