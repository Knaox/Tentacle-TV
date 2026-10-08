# shellcheck shell=bash
# La MISE À JOUR depuis les piles officielles TELLES QUE LIVRÉES en 1.24.0 (tentacle-full,
# tentacle-db, lues sous l'étiquette server-v1.24.0), par Compose — trois cas pour chacune :
#   1. l'image passe en 1.25 SANS toucher au compose : la migration lit DB_HOST=db,
#      DB_PASSWORD_FILE et les défauts tentacle/tentacle ; l'écran d'attente s'affiche ;
#   2. les lignes EXACTES du guide de retrait appliquées (stackEdit.mjs guide), puis
#      `up -d --remove-orphans` : plus de MariaDB, tout marche ; le compose oublié à moitié
#      (db retiré, depends_on gardé) est refusé par Compose avec SON message ;
#   3. la NOUVELLE pile posée par-dessus AVANT la migration (une pile Portainer qui suit le
#      dépôt) : source_missing, aucune base vide ; puis le détour par l'étiquette (l'ancien
#      compose remis) : la migration se fait ; puis la nouvelle pile, définitivement.
# Réseau interne imposé par un fichier de surcharge. Données : la copie NEUTRALISÉE.

STACK_PROJECT="sqlbench3-stack"
STACK_PORT="${BENCH_STACK_PORT:-47481}"
STACK_BASE="http://127.0.0.1:$STACK_PORT"

compose() { (cd "$STACK_DIR" && DOCKER_HOST="${DOCKER_HOST:-unix://${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock}" \
  "${BENCH_COMPOSE:-docker-compose}" -p "$STACK_PROJECT" -f compose.yaml -f internal.yaml "$@"); }

# Tout ce que le projet Compose du banc a créé, retrouvé par SON étiquette (sans fichier compose :
# un essai interrompu a pu laisser une base remplie, que la copie suivante heurterait).
stack_teardown() {
  local label="label=com.docker.compose.project=$STACK_PROJECT" ids
  ids=$(eng ps -a -q --filter "$label"); [ -z "$ids" ] || eng rm -f $ids >/dev/null
  ids=$(eng volume ls -q --filter "$label"); [ -z "$ids" ] || eng volume rm -f $ids >/dev/null
  return 0
}

stack_prepare() { # full|db
  STACK_DIR="$BENCH_DIR/stack-$1"
  stack_teardown
  rm -rf "$STACK_DIR" && mkdir -p "$STACK_DIR/media"
  printf 'networks:\n  default:\n    internal: true\n' > "$STACK_DIR/internal.yaml"
  # Les images doivent être là (réseau interne) : l'image éprouvée sous une étiquette du dépôt
  # d'images, Jellyfin 12 depuis la 12.1 du banc. Étiquettes LOCALES seulement.
  eng tag "$NEW_IMAGE" ghcr.io/knaox/tentacle-tv:sqlite-bench >/dev/null
  eng image exists docker.io/jellyfin/jellyfin:12 2>/dev/null || eng tag docker.io/jellyfin/jellyfin:12.1 docker.io/jellyfin/jellyfin:12 >/dev/null
}

stack_env() { # version-de-l'image
  printf 'TENTACLE_VERSION=%s\nTENTACLE_PORT=%s\nJELLYFIN_PORT=%s\nJELLYFIN_DISCOVERY_PORT=%s\nMEDIA_PATH=%s\n' \
    "$1" "$STACK_PORT" "${BENCH_STACK_JF_PORT:-47497}" "${BENCH_STACK_UDP:-47398}" "$STACK_DIR/media" > "$STACK_DIR/.env"
}

old_compose() { git -C "$REPO" show "server-v1.24.0:stacks/tentacle-$1/compose.yaml" > "$STACK_DIR/compose.yaml"; }
new_compose() { cp "$REPO/stacks/$([ "$1" = full ] && echo tentacle-full || echo tentacle-only)/compose.yaml" "$STACK_DIR/compose.yaml"; }

stack_db_exec() { eng exec -i "$STACK_PROJECT-db-1" sh -c 'MYSQL_PWD="$(cat /run/tentacle-secrets/db_root_password)" mariadb -uroot "$@"' sh "$@"; }

stack_checksums() { # sortie
  local tables
  tables=$(stack_db_exec -N -e "SELECT GROUP_CONCAT(CONCAT('\`', TABLE_NAME, '\`') ORDER BY TABLE_NAME) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'tentacle'")
  stack_db_exec -N tentacle -e "CHECKSUM TABLE $tables EXTENDED" > "$1"
  chmod 600 "$1"
}

# La pile de 1.24.0 telle que livrée, avec les données de la copie neutralisée dans SA base.
stack_install_124() { # full|db
  stack_teardown
  old_compose "$1"; stack_env v1.24.0
  compose up -d db >/dev/null 2>&1
  local end=$((SECONDS + 180))
  until eng exec "$STACK_PROJECT-db-1" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; do
    [ $SECONDS -lt $end ] || die "la base de la pile ne démarre pas"; sleep 2
  done
  check_dump
  stack_db_exec tentacle < "$DUMP"
  compose up -d >/dev/null 2>&1
  wait_http "$STACK_BASE/api/health" 300
}

stack_state() { # étiquette → une ligne : l'état de la base vu par /api/health, les fichiers de la base
  local health files
  health=$(curl -fsS --max-time 5 "$STACK_BASE/api/health" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const d=JSON.parse(s).database;console.log(d?`${d.state}${d.reason?` (${d.reason})`:""}`:"ready (1.24)")}catch{console.log("injoignable")}})')
  files=$(eng exec "$STACK_PROJECT-tentacle-1" sh -c 'ls /app/apps/backend/data 2>/dev/null | grep -E "tentacle\.db|migrat|setup-complete" | tr "\n" " "' 2>/dev/null)
  echo "- $1 : base « $health » ; fichiers : ${files:-—}" >> "$RUN/report.md"
}

cmd_stacks() {
  ensure_dir; load_secrets; new_run stacks
  REPO="$(cd "$HERE/../../.." && pwd)"
  echo "# Banc SQLite — mise à jour depuis les piles officielles de 1.24.0" > "$RUN/report.md"
  for st in ${BENCH_STACKS:-full db}; do
    stack_prepare "$st"
    echo -e "\n## tentacle-$st (server-v1.24.0)\n" >> "$RUN/report.md"
    # ── Cas 1 : l'image seule.
    stack_install_124 "$st"
    stack_checksums "$RUN/$st-mariadb-before.txt"
    stack_env sqlite-bench
    node "$HERE/watchMigration.mjs" "$STACK_BASE" - "$RUN/$st-watch.json" --until ready --timeout 900 > "$RUN/$st-watch-summary.json" &
    local watch=$!
    compose up -d >/dev/null 2>&1
    wait "$watch"
    stack_state "1. image 1.25, compose inchangé"
    node -e 'const w=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(`  écran d'\''attente vu : ${w.waitingScreenFromMs!==null?"oui":"non"} ; coupure : ${(w.clientCutMs/1000).toFixed(1)} s`)' "$RUN/$st-watch-summary.json" >> "$RUN/report.md"
    stack_checksums "$RUN/$st-mariadb-after.txt"
    diff -q "$RUN/$st-mariadb-before.txt" "$RUN/$st-mariadb-after.txt" >/dev/null && echo "  MariaDB intacte" >> "$RUN/report.md" || echo "  MariaDB MODIFIÉE" >> "$RUN/report.md"
    # ── Cas 2 : les lignes du guide, puis le compose oublié à moitié.
    node "$HERE/stackEdit.mjs" forgotten "$STACK_DIR/compose.yaml" "$STACK_DIR/forgotten.yaml" >/dev/null
    (cd "$STACK_DIR" && DOCKER_HOST="${DOCKER_HOST:-unix://${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock}" "${BENCH_COMPOSE:-docker-compose}" -f forgotten.yaml config -q 2>&1 | tail -1 | sed 's/^/  compose oublié à moitié : /') >> "$RUN/report.md" || true  # son refus EST le résultat attendu
    node "$HERE/stackEdit.mjs" guide "$STACK_DIR/compose.yaml" "$STACK_DIR/guided.yaml" >/dev/null
    cp "$STACK_DIR/guided.yaml" "$STACK_DIR/compose.yaml"
    compose up -d --remove-orphans >/dev/null 2>&1
    wait_http "$STACK_BASE/api/health" 180
    stack_state "2. lignes du guide appliquées, --remove-orphans"
    echo "  conteneurs de la base restants : $(eng ps -a --format '{{.Names}}' | grep -cE "^$STACK_PROJECT-(db|init)-1$") ; volume tentacle-db : $(eng volume exists "${STACK_PROJECT}_tentacle-db" && echo gardé || echo absent)" >> "$RUN/report.md"
    eng volume rm "${STACK_PROJECT}_tentacle-db" "${STACK_PROJECT}_tentacle-secrets" >/dev/null 2>&1 && echo "  docker volume rm (la dernière étape du guide) : fait" >> "$RUN/report.md"
    compose restart tentacle >/dev/null 2>&1; wait_http "$STACK_BASE/api/health" 180
    stack_state "   après suppression des volumes de la base et redémarrage"
    new_compose "$st"
    compose up -d --remove-orphans >/dev/null 2>&1; wait_http "$STACK_BASE/api/health" 180
    stack_state "   l'autre voie : la nouvelle pile posée à la place"
    # ── Cas 3 : la nouvelle pile AVANT la migration, puis le détour par l'étiquette.
    stack_install_124 "$st"
    new_compose "$st"; stack_env sqlite-bench
    compose up -d --remove-orphans >/dev/null 2>&1
    node "$HERE/watchMigration.mjs" "$STACK_BASE" - "$RUN/$st-orphan.json" --until failed --timeout 300 > /dev/null || true
    stack_state "3. nouvelle pile posée AVANT la migration"
    echo "  assistant : $(curl -s -o /dev/null -w '%{http_code}' "$STACK_BASE/api/setup/status") sur /api/setup/status (fermé = 503)" >> "$RUN/report.md"
    old_compose "$st"
    compose up -d >/dev/null 2>&1
    wait_http "$STACK_BASE/api/config" 300
    node "$HERE/watchMigration.mjs" "$STACK_BASE" - "$RUN/$st-detour.json" --until ready --timeout 900 > /dev/null || true
    stack_state "   détour : l'ancien compose remis (étiquette server-v1.24.0)"
    new_compose "$st"
    compose up -d --remove-orphans >/dev/null 2>&1; wait_http "$STACK_BASE/api/health" 180
    stack_state "   puis la nouvelle pile, définitivement"
    stack_teardown
  done
  log "rapport : $RUN/report.md"
}

# L'installation NEUVE sur chacune des deux piles d'aujourd'hui (§ 8.9) : la pile telle quelle
# (image éprouvée, réseau interne), l'état de l'assistant relevé — aucune base à régler, la pile
# reconnue. Le parcours lui-même se vérifie au navigateur : BENCH_FRESH_KEEP=full|only laisse
# cette pile-là en service, son code d'installation dans le dossier du passage (0600).
cmd_fresh() {
  ensure_dir; load_secrets; new_run fresh
  REPO="$(cd "$HERE/../../.." && pwd)"
  echo "# Banc SQLite — installation neuve sur les deux piles" > "$RUN/report.md"
  for st in ${BENCH_FRESH:-full only}; do
    stack_prepare "$st"; new_compose "$st"; stack_env sqlite-bench
    compose up -d >/dev/null 2>&1
    wait_http "$STACK_BASE/api/setup/status" 300
    local status host files code
    status=$(curl -fsS "$STACK_BASE/api/setup/status")
    host=$(curl -fsS "$STACK_BASE/api/setup/host" || echo '{}')
    files=$(eng exec "$STACK_PROJECT-tentacle-1" sh -c 'ls /app/apps/backend/data | tr "\n" " "' 2>/dev/null)
    code=$(eng logs "$STACK_PROJECT-tentacle-1" 2>&1 | grep -oE "\b[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}\b" | tail -1)
    [ -n "$code" ] && (umask 077 && echo "$code" > "$RUN/$st-setup-code.txt")
    {
      echo; echo "## stacks/tentacle-$st"; echo
      echo "- /api/setup/status : $(echo "$status" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(`état ${j.state}, ouvert ${j.setupOpen}, base ouverte ${j.dbConnected}`)})')"
      echo "- /api/setup/host : $(echo "$host" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s||"{}");console.log(`pile ${j.stack ?? "?"}, conteneur ${j.containerized ?? "?"}, code exigé ${j.codeRequired ?? "?"}`)})')"
      echo "- dossier de données : ${files:-—}"
      echo "- lignes [db-migration] au journal : $(eng logs "$STACK_PROJECT-tentacle-1" 2>&1 | grep -c "db-migration" || true)"
      echo "- code d'installation au journal : $([ -n "$code" ] && echo "oui (gardé à part, 0600)" || echo "non")"
    } >> "$RUN/report.md"
    [ "${BENCH_FRESH_KEEP:-}" = "$st" ] || stack_teardown
  done
  log "rapport : $RUN/report.md"
}
