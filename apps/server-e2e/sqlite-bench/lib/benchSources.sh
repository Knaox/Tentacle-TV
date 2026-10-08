# shellcheck shell=bash
# Les SOURCES moins courantes de la migration :
# - `external` : une base EXTERNE lue par un compte qui n'a QUE le droit SELECT (la copie
#   neutralisée, sur la MariaDB du banc), puis une MySQL 8.4 (auth caching_sha2 par défaut) ;
# - `old` : une base créée par l'image 1.23.0 ELLE-MÊME (schéma d'une 1.2x d'avant), avec la
#   Famille en v1 (les cas interdits du banc Famille), migrée puis vérifiée contre attendu.txt.
# Chaque migration se fait par la CLI (`tentacle db migrate`) sur un volume neuf, sans serveur.

SRC_VOL="sqlbench3-src-data"

# Une migration par la CLI depuis une URL de source ; écrit son verdict et ses comptes au rapport.
cli_migrate() { # url, étiquette
  local env=(-e "DATABASE_URL=$1")
  eng volume rm -f "$SRC_VOL" >/dev/null 2>&1 || true
  eng volume create "$SRC_VOL" >/dev/null
  local t0; t0=$(date +%s%N)
  eng run --rm --network "$NET" "${env[@]}" -v "$SRC_VOL:/app/apps/backend/data" "$NEW_IMAGE" tentacle db migrate > "$RUN/$2-cli.txt" 2>&1 || true
  echo "- $2 : $((($(date +%s%N) - t0) / 1000000)) ms ; $(grep -E "^Migration terminée|^Échec|déjà migrée|aucune table|Lignes écartées|non reconnues|refusées|Anciennes tables" "$RUN/$2-cli.txt" | head -5 | tr '\n' ' ')" >> "$RUN/report.md"
}

copy_src_db() { # destination
  eng run --rm -v "$SRC_VOL:/data:ro" -v "$(dirname "$1"):/out:z" --entrypoint sh "$REF_IMAGE" -c \
    "cp /data/tentacle.db /out/$(basename "$1") 2>/dev/null; for s in -wal -shm; do [ -f /data/tentacle.db\$s ] && cp /data/tentacle.db\$s /out/$(basename "$1")\$s; done; true"
  chmod 600 "$1"* 2>/dev/null || true
}

cmd_external() {
  ensure_dir; load_secrets; new_run external
  echo "# Banc SQLite — sources externes" > "$RUN/report.md"
  echo >> "$RUN/report.md"
  # 1. Un compte SELECT seul sur la MariaDB du banc (la copie neutralisée).
  eng exec -e MYSQL_PWD="$DB_ROOT_PW" "$DB" mariadb -uroot -e \
    "DROP USER IF EXISTS 'reader'@'%'; CREATE USER 'reader'@'%' IDENTIFIED BY '$DB_PW'; GRANT SELECT ON tentacle.* TO 'reader'@'%';"
  cli_migrate "mysql://reader:$DB_PW@$DB:3306/tentacle" "mariadb-select-seul"
  # 2. MySQL 8.4 (si l'image est là : le réseau du banc n'a pas Internet).
  local my=sqlbench3-mysql myvol=sqlbench3-mysql-data
  if eng image exists docker.io/library/mysql:8.4 2>/dev/null; then
    eng rm -f "$my" >/dev/null 2>&1 || true; eng volume rm -f "$myvol" >/dev/null 2>&1 || true
    eng run -d --name "$my" --network "$NET" -e MYSQL_ROOT_PASSWORD="$DB_ROOT_PW" -e MYSQL_DATABASE=tentacle \
      -v "$myvol:/var/lib/mysql" docker.io/library/mysql:8.4 >/dev/null
    local end=$((SECONDS + 180))
    until eng exec -e MYSQL_PWD="$DB_ROOT_PW" "$my" mysql -uroot -e "SELECT 1" tentacle >/dev/null 2>&1; do
      [ $SECONDS -lt $end ] || die "MySQL 8.4 ne démarre pas"; sleep 2
    done
    check_dump
    if eng exec -i -e MYSQL_PWD="$DB_ROOT_PW" "$my" mysql -uroot tentacle < "$DUMP" > "$RUN/mysql-load.txt" 2>&1; then
      echo "- MySQL 8.4 : copie neutralisée chargée" >> "$RUN/report.md"
      cli_migrate "mysql://root:$DB_ROOT_PW@$my:3306/tentacle" "mysql-8.4"
    else
      echo "- MySQL 8.4 : la copie (export MariaDB) ne s'y charge pas — $(tail -1 "$RUN/mysql-load.txt" | cut -c1-160)" >> "$RUN/report.md"
    fi
    eng rm -f "$my" >/dev/null 2>&1 || true; eng volume rm -f "$myvol" >/dev/null 2>&1 || true
  else
    echo "- MySQL 8.4 : image absente (podman pull docker.io/library/mysql:8.4, hors du réseau du banc)" >> "$RUN/report.md"
  fi
  eng volume rm -f "$SRC_VOL" >/dev/null 2>&1 || true
  log "rapport : $RUN/report.md"
}

cmd_old() {
  ensure_dir; load_secrets; new_run old
  echo "# Banc SQLite — schéma d'une 1.2x d'avant, Famille v1" > "$RUN/report.md"
  echo >> "$RUN/report.md"
  local repo db=sqlbench3-old-db dbvol=sqlbench3-old-db-data old=sqlbench3-old-123 oldvol=sqlbench3-old-123-data
  repo="$(cd "$HERE/../../.." && pwd)"
  local fam="$repo/apps/backend/test/famille-migration"
  local url="mysql://tentacle:$DB_PW@$db:3306/tentacle"
  for c in "$db" "$old"; do eng rm -f "$c" >/dev/null 2>&1 || true; done
  eng volume rm -f "$dbvol" "$oldvol" >/dev/null 2>&1 || true
  eng run -d --name "$db" --network "$NET" -e MARIADB_ROOT_PASSWORD="$DB_ROOT_PW" -e MARIADB_DATABASE=tentacle \
    -e MARIADB_USER=tentacle -e MARIADB_PASSWORD="$DB_PW" -v "$dbvol:/var/lib/mysql" "$MARIADB_IMAGE" >/dev/null
  local end=$((SECONDS + 120))
  until eng exec "$db" healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; do
    [ $SECONDS -lt $end ] || die "MariaDB (ancien schéma) ne démarre pas"; sleep 1
  done
  # Le schéma, posé comme la 1.23.0 le posait : son assistant faisait `prisma db push` sur une base
  # vide, puis son entrypoint appliquait core-init.sql — ici avec SES outils, dans SON image.
  eng run --rm --network "$NET" -e "DATABASE_URL=$url" --entrypoint sh "${BENCH_OLD_IMAGE:-ghcr.io/knaox/tentacle-tv:v1.23.0}" -c \
    'cd /app/apps/backend && npx prisma db push --skip-generate --accept-data-loss && npx prisma db execute --schema prisma/schema.prisma --file prisma/core-init.sql' \
    > "$RUN/old-schema.txt" 2>&1 || die "la 1.23.0 n'a pas posé son schéma (voir old-schema.txt)"
  local tables
  tables=$(eng exec -e MYSQL_PWD="$DB_ROOT_PW" "$db" mariadb -uroot -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'tentacle'")
  echo "- schéma posé par la 1.23.0 : $tables tables" >> "$RUN/report.md"
  # Une installation faite sur ce schéma, puis migrée.
  echo "INSERT INTO server_config (\`key\`, \`value\`) VALUES ('setup_completed', 'true'), ('jwt_secret', 'banc-ancien-schema');" \
    | eng exec -i -e MYSQL_PWD="$DB_ROOT_PW" "$db" mariadb -uroot tentacle > "$RUN/setup.txt" 2>&1
  cli_migrate "$url" "base-1.23"
  # La Famille v1 : le schéma v1 et les cas interdits du banc Famille (le schéma de la 1.23 porte déjà
  # « un compte, une famille » : ces cas n'y entrent pas), avec ce qui fait reconnaître une installation.
  eng exec -e MYSQL_PWD="$DB_ROOT_PW" "$db" mariadb -uroot -e \
    "DROP DATABASE IF EXISTS famille_v1; CREATE DATABASE famille_v1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON famille_v1.* TO 'tentacle'@'%';"
  {
    cat "$fam/v1-schema.sql" "$fam/fixtures-v1.sql"
    echo "CREATE TABLE server_config (\`key\` VARCHAR(191) PRIMARY KEY, \`value\` TEXT NOT NULL);"
    echo "CREATE TABLE share_links (id VARCHAR(191) PRIMARY KEY, token VARCHAR(64) NOT NULL);"
    echo "CREATE TABLE provisioning_codes (id VARCHAR(191) PRIMARY KEY, code VARCHAR(32) NOT NULL);"
    echo "INSERT INTO server_config VALUES ('setup_completed', 'true'), ('jwt_secret', 'banc-famille-v1');"
  } | eng exec -i -e MYSQL_PWD="$DB_ROOT_PW" "$db" mariadb -uroot famille_v1 > "$RUN/fixtures.txt" 2>&1 \
    && echo "- Famille v1 chargée (schéma et cas du banc Famille)" >> "$RUN/report.md" \
    || echo "- chargement de la Famille v1 : $(tail -1 "$RUN/fixtures.txt")" >> "$RUN/report.md"
  cli_migrate "mysql://tentacle:$DB_PW@$db:3306/famille_v1" "famille-v1"
  copy_src_db "$RUN/old.db"
  echo "- Famille v2 après migration, contre attendu.txt : $(node "$HERE/familyCheck.mjs" "$RUN/old.db" "$fam/attendu.txt" 2>/dev/null | tr '\n' ' ')" >> "$RUN/report.md"
  rm -f "$RUN"/old.db*
  for c in "$db" "$old"; do eng rm -f "$c" >/dev/null 2>&1 || true; done
  eng volume rm -f "$dbvol" "$oldvol" "$SRC_VOL" >/dev/null 2>&1 || true
  log "rapport : $RUN/report.md"
}
