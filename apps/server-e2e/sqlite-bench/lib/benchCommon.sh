# shellcheck shell=bash
# Les gestes du banc, partagés par ses scénarios (bench.sh). Tout ce qui est créé porte le
# préfixe sqlbench3- ; rien n'est touché d'autre. Les secrets du banc (mots de passe de la
# MariaDB jetable, jetons des comptes de test) vivent dans $BENCH_DIR, 0600.

log() { printf '[banc] %s\n' "$*" >&2; }
die() { log "ÉCHEC : $*"; exit 1; }
eng() { "$ENGINE" "$@"; }

ensure_dir() {
  mkdir -p "$BENCH_DIR/runs"
  chmod 700 "$BENCH_DIR"
}

new_run() {
  RUN="$BENCH_DIR/runs/$(date +%Y%m%d-%H%M%S)-$1"
  mkdir -p "$RUN"
  chmod 700 "$RUN"
  ln -sfn "$RUN" "$BENCH_DIR/runs/last-$1"
  log "relevés : $RUN"
}

# Le banc ne charge JAMAIS l'original (§ 7.2) : l'en-tête posé par neutralize.mjs fait foi.
check_dump() {
  [ -f "$DUMP" ] || die "copie neutralisée introuvable : $DUMP (voir neutralize.mjs)"
  case "$DUMP" in *Téléchargements*|*Downloads*) die "le banc ne lit rien dans Téléchargements" ;; esac
  head -c 200 "$DUMP" | grep -q "^-- Copie NEUTRALISÉE pour le banc SQLite" || die "$DUMP n'est pas une copie neutralisée : refus"
}

random_hex() { head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

load_secrets() {
  local file="$BENCH_DIR/secrets.env"
  if [ ! -f "$file" ]; then
    (umask 077 && printf 'DB_ROOT_PW=%s\nDB_PW=%s\n' "$(random_hex)" "$(random_hex)" > "$file")
  fi
  # shellcheck disable=SC1090
  . "$file"
  SOURCE_URL="mysql://tentacle:$DB_PW@$DB:3306/tentacle"
  HOST_SOURCE_URL="mysql://root:$DB_ROOT_PW@127.0.0.1:$DB_PORT/tentacle"
}

# Réseau INTERNE : aucune sortie vers Internet ni vers le réseau local (§ 7.3).
ensure_network() {
  if ! eng network inspect "$NET" >/dev/null 2>&1; then
    eng network create --internal --subnet 10.89.77.0/24 "$NET" >/dev/null
  fi
  [ "$(eng network inspect "$NET" --format '{{.Internal}}')" = "true" ] || die "le réseau $NET n'est pas interne"
}

wait_http() { # url, secondes
  local end=$((SECONDS + ${2:-180}))
  until curl -fsS -o /dev/null --max-time 3 "$1" 2>/dev/null; do
    [ $SECONDS -lt $end ] || die "ne répond pas : $1"
    sleep 1
  done
}

start_mariadb() {
  eng rm -f "$DB" >/dev/null 2>&1 || true
  eng run -d --name "$DB" --network "$NET" -p "127.0.0.1:$DB_PORT:3306" \
    -e MARIADB_ROOT_PASSWORD="$DB_ROOT_PW" -e MARIADB_DATABASE=tentacle \
    -e MARIADB_USER=tentacle -e MARIADB_PASSWORD="$DB_PW" -e TZ="${BENCH_DB_TZ:-UTC}" \
    -v "$DBVOL:/var/lib/mysql" "$MARIADB_IMAGE" >/dev/null
  local end=$((SECONDS + 120))
  until eng exec "$DB" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; do
    [ $SECONDS -lt $end ] || die "MariaDB du banc ne démarre pas"
    sleep 1
  done
}

load_dump() {
  check_dump
  local t0=$SECONDS
  eng exec -i -e MYSQL_PWD="$DB_ROOT_PW" "$DB" mariadb -uroot tentacle < "$DUMP"
  log "copie neutralisée chargée en $((SECONDS - t0)) s"
}

# L'empreinte de TOUTES les tables (CHECKSUM TABLE) : MariaDB doit rester intacte.
mariadb_checksums() { # fichier de sortie
  local tables
  tables=$(eng exec -e MYSQL_PWD="$DB_ROOT_PW" "$DB" mariadb -uroot -N -e \
    "SELECT GROUP_CONCAT(CONCAT('\`', TABLE_NAME, '\`') ORDER BY TABLE_NAME) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'tentacle'")
  eng exec -e MYSQL_PWD="$DB_ROOT_PW" "$DB" mariadb -uroot -N tentacle -e "CHECKSUM TABLE $tables EXTENDED" > "$1"
  chmod 600 "$1"
}

# La pile de Damien : la source désignée par data/database.json (l'ancien assistant).
write_database_json() {
  eng run --rm -v "$VOL:/data" --entrypoint sh "$REF_IMAGE" -c \
    "umask 077 && printf '{\"url\":\"%s\"}' '$SOURCE_URL' > /data/database.json && chown ${PUID:-1000}:${PGID:-1000} /data/database.json" >/dev/null
}

# Le disque qui porte les volumes du moteur : celui que le NAS simulé bride.
volume_disk() {
  local source
  source=$(findmnt -n -o SOURCE -T "$(eng info --format '{{.Store.VolumePath}}')" | sed 's/\[.*//')
  echo "/dev/$(lsblk -no PKNAME "$source" | head -1)"
}

start_tentacle() { # image [slow|nas]
  local image="$1" extra=() disk
  eng rm -f "$TC" >/dev/null 2>&1 || true
  [ "$WEB_UI" = "off" ] && extra+=(-e TENTACLE_WEB_UI=off)
  [ "$SOURCE" = "env" ] && extra+=(-e "DATABASE_URL=$SOURCE_URL")
  case "${2:-}" in
    slow) extra+=(--cpus 0.5) ;;
    nas) disk=$(volume_disk)
      extra+=(--cpus 0.5 --device-read-bps "$disk:30mb" --device-write-bps "$disk:30mb" --device-read-iops "$disk:400" --device-write-iops "$disk:400") ;;
  esac
  # La charge (§ 8.7) mesure la base, pas le limiteur de débit de l'API (1 000 / min / adresse).
  [ -n "${BENCH_RATE_LIMIT:-}" ] && extra+=(-e "RATE_LIMIT=$BENCH_RATE_LIMIT")
  # --restart : « Migrer à nouveau » redémarre le serveur, comme une vraie pile.
  eng run -d --name "$TC" --network "$NET" --restart unless-stopped -p "127.0.0.1:$PORT:3000" \
    -e TZ=Europe/Paris "${extra[@]}" -v "$VOL:/app/apps/backend/data" "$image" >/dev/null
}

stop_tentacle() { eng stop -t 20 "$TC" >/dev/null 2>&1 || true; eng rm -f "$TC" >/dev/null 2>&1 || true; }

# Ce que contient le dossier de données (noms et tailles : jamais le contenu).
data_listing() { # fichier de sortie
  eng run --rm -v "$VOL:/data:ro" --entrypoint sh "$REF_IMAGE" -c 'cd /data && ls -la && du -sk .' > "$1" 2>&1 || true
}

# Une copie cohérente de tentacle.db pour la comparer : serveur ARRÊTÉ le temps de la copie.
copy_sqlite() { # destination
  eng stop -t 20 "$TC" >/dev/null
  eng run --rm -v "$VOL:/data:ro" -v "$(dirname "$1"):/out:z" --entrypoint sh "$REF_IMAGE" -c \
    "cp /data/tentacle.db /out/$(basename "$1") && for s in -wal -shm; do [ -f /data/tentacle.db\$s ] && cp /data/tentacle.db\$s /out/$(basename "$1")\$s; done; true"
  chmod 600 "$1"* 2>/dev/null || true
  eng start "$TC" >/dev/null
}

memory_of() { eng stats --no-stream --format '{{.MemUsage}}' "$TC" 2>/dev/null || echo "?"; }
