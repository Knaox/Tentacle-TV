# shellcheck shell=bash
# Les scénarios du banc (§ 8) : up, migrate, kill, rollback, down. Chacun écrit ses relevés
# dans $BENCH_DIR/runs/<date>-<scénario>/ et un report.md ANONYME (durées, tailles, comptes).

token() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))[process.argv[2]])' "$BENCH_DIR/tokens.json" "$1"; }

# Le Jellyfin du banc (vrais fichiers) et ses comptes : déjà prêts, ou créés ici.
ensure_jellyfin() {
  # Un seul Jellyfin du banc en service : le nom que porte la copie neutralisée ne désigne que lui.
  local other
  for other in $(eng ps --format '{{.Names}}' | grep '^sqlbench-jellyfin' | grep -vx "$JF" || true); do eng stop "$other" >/dev/null; done
  if ! eng container inspect "$JF" >/dev/null 2>&1; then
    [ -d "$MEDIA" ] || die "dossier des médias du banc introuvable : $MEDIA"
    eng run -d --name "$JF" --network "$NET" --network-alias "$JF_HOST" -p "127.0.0.1:$JF_PORT:8096" \
      -v "$JF_VOL-config:/config" -v "$JF_VOL-cache:/cache" -v "$MEDIA:/media:ro,z" "$JF_IMAGE" >/dev/null
  fi
  eng start "$JF" >/dev/null 2>&1 || true
  node "$HERE/jellyfinSetup.mjs" "http://127.0.0.1:$JF_PORT" "${BENCH_ACCOUNTS:-23}" "$USERS" >/dev/null
  if [ ! -f "$DUMP" ]; then
    [ -n "${BENCH_ORIGINAL:-}" ] || die "pas de copie neutralisée : BENCH_ORIGINAL=<export> pour la produire (l'original n'est que LU)"
    node "$HERE/neutralize.mjs" "$BENCH_ORIGINAL" "$USERS" "$DUMP"
  fi
}

# Le registre local des extensions (Vigie 1.24.1 et 1.25.0), servi DANS le réseau interne.
ensure_registry() {
  [ -f "$BENCH_DIR/registry/registry.json" ] || die "registre local absent : bench.sh vigie-build"
  if ! eng container inspect "$REG" >/dev/null 2>&1; then
    eng run -d --name "$REG" --network "$NET" -v "$BENCH_DIR/registry:/srv:ro,z" --entrypoint node "$NEW_IMAGE" -e '
      const http = require("http"), fs = require("fs"), path = require("path");
      http.createServer((q, s) => {
        const file = path.join("/srv", path.basename(decodeURIComponent(q.url.split("?")[0])));
        fs.readFile(file, (e, b) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200); s.end(b); } });
      }).listen(8080);' >/dev/null
  fi
  eng start "$REG" >/dev/null 2>&1 || true
}

# Vigie construit depuis ses SOURCES locales (aucun téléchargement d'archive publiée).
build_vigie() { # dépôt-ou-worktree, référence git, version
  local out="$BENCH_DIR/vigie-$3"
  rm -rf "$out" && mkdir -p "$out"
  git -C "$1" archive "$2" | tar -x -C "$out"
  node -e '
    const fs = require("fs"), [dir, v] = process.argv.slice(1);
    for (const f of ["plugin.json", "package.json"]) { const j = JSON.parse(fs.readFileSync(`${dir}/${f}`)); j.version = v; fs.writeFileSync(`${dir}/${f}`, JSON.stringify(j, null, 2)); }' "$out" "$3"
  (cd "$out" && npm ci --prefer-offline --no-audit --no-fund >/dev/null && npm run package >/dev/null)
  mkdir -p "$BENCH_DIR/registry"
  cp "$out/plugin-vigie-v$3.tar.gz" "$BENCH_DIR/registry/"
  cp "$out/plugin.json" "$BENCH_DIR/registry/plugin-vigie-v$3.json"
}

# L'image à éprouver, construite depuis HEAD du dépôt : un export (git archive), le serveur
# passé en 1.25.0 DANS l'export seulement (versions.json, package.json) — rien dans le dépôt.
cmd_image() {
  ensure_dir
  local src="$BENCH_DIR/src" repo
  repo="$(cd "$HERE/../../.." && pwd)"
  rm -rf "$src" && mkdir -p "$src"
  git -C "$repo" archive HEAD | tar -x -C "$src"
  git -C "$repo" rev-parse --short HEAD > "$src/.bench-commit"
  node -e '
    const fs = require("fs"), dir = process.argv[1];
    const v = JSON.parse(fs.readFileSync(`${dir}/versions.json`)); v.server = "1.25.0";
    fs.writeFileSync(`${dir}/versions.json`, JSON.stringify(v, null, 2) + "\n");
    const p = JSON.parse(fs.readFileSync(`${dir}/apps/backend/package.json`)); p.version = "1.25.0";
    fs.writeFileSync(`${dir}/apps/backend/package.json`, JSON.stringify(p, null, 2) + "\n");' "$src"
  local t0=$SECONDS
  eng build -t "$NEW_IMAGE" -f "$src/Dockerfile" "$src" > "$BENCH_DIR/build.log" 2>&1 || die "construction de l'image : voir $BENCH_DIR/build.log"
  log "image $NEW_IMAGE (commit $(cat "$src/.bench-commit")) en $((SECONDS - t0)) s"
}

cmd_vigie_build() {
  ensure_dir
  build_vigie "$VIGIE_REPO" "v1.24.1" "1.24.1"
  build_vigie "$VIGIE_SQLITE" "HEAD" "1.25.0"
  node "$HERE/vigieRegistry.mjs" "$BENCH_DIR/registry" "$REG_URL" "$VIGIE_SQLITE/scripts/lib/registry-entry.mjs" \
    "$BENCH_DIR/registry/plugin-vigie-v1.24.1.tar.gz" "$BENCH_DIR/registry/plugin-vigie-v1.25.0.tar.gz"
}

cmd_up() {
  ensure_dir; load_secrets; ensure_network; ensure_jellyfin; check_dump
  stop_tentacle
  eng rm -f "$DB" >/dev/null 2>&1 || true
  eng volume rm -f "$VOL" "$DBVOL" >/dev/null 2>&1 || true
  new_run up
  start_mariadb; load_dump
  [ "$SOURCE" = "file" ] && write_database_json
  start_tentacle "$REF_IMAGE"
  wait_http "$BASE/api/health" 300
  node "$HERE/benchTokens.mjs" "$BASE" "$USERS" "$HOST_SOURCE_URL" "$BENCH_DIR/tokens.json"
  if [ "$VIGIE" = "1" ]; then
    ensure_registry
    node "$HERE/vigieInstall.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$REG_URL/registry.json" marketplace > "$RUN/vigie-offered.json"
    node "$HERE/vigieInstall.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$REG_URL/registry.json" install 1.24.1
  fi
  node "$HERE/apiSurvey.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$BENCH_DIR/api-before.json"
  mariadb_checksums "$BENCH_DIR/mariadb-before.txt"
  data_listing "$RUN/data.txt"
  log "prêt : Tentacle 1.24.0 sur la copie neutralisée — $BASE"
}

# Attend la fin de la copie du cache en fond (sinon la comparaison verrait un cache partiel).
wait_cache_done() {
  local end=$((SECONDS + 1800)) phase
  while :; do
    phase=$(curl -fsS -H "Authorization: Bearer $(token admin)" "$BASE/api/admin/database/migration" 2>/dev/null \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).cache.phase)}catch{console.log("?")}})')
    case "$phase" in done|none) return 0 ;; esac
    [ $SECONDS -lt $end ] || { log "copie du cache non finie après 30 min ($phase)"; return 1; }
    sleep 2
  done
}

# La comparaison « à froid » : une migration faite par la CLI (`tentacle db migrate`, sans serveur)
# sur un volume neuf qui ne porte que la source, puis comparée à MariaDB — aucune écriture du
# serveur vivant ne s'y mêle. Le cache TMDB, copié en fond par le serveur seulement, y est vide.
pristine_compare() {
  local vol=sqlbench3-pristine env=()
  eng volume rm -f "$vol" >/dev/null 2>&1 || true
  eng volume create "$vol" >/dev/null
  eng run --rm -v "$VOL:/src:ro" -v "$vol:/data" --entrypoint sh "$REF_IMAGE" -c \
    'cp /src/database.json /data/ 2>/dev/null; chown -R 1000:1000 /data' >/dev/null
  [ "$SOURCE" = "env" ] && env+=(-e "DATABASE_URL=$SOURCE_URL")
  eng run --rm --network "$NET" "${env[@]}" -v "$vol:/app/apps/backend/data" "$NEW_IMAGE" tentacle db migrate > "$RUN/cli-migrate.txt" 2>&1 || true
  eng run --rm -v "$vol:/data:ro" -v "$RUN:/out:z" --entrypoint sh "$REF_IMAGE" -c \
    'cp /data/tentacle.db /out/pristine.db; for s in -wal -shm; do [ -f /data/tentacle.db$s ] && cp /data/tentacle.db$s /out/pristine.db$s; done; true'
  chmod 600 "$RUN"/pristine.db* 2>/dev/null || true
  node "$HERE/dbCompare.mjs" "$HOST_SOURCE_URL" "$RUN/pristine.db" "$RUN/db-pristine.json" > "$RUN/db-pristine.md" || true
  rm -f "$RUN"/pristine.db*
  eng volume rm -f "$vol" >/dev/null 2>&1 || true
}

mariadb_size() {
  eng exec -e MYSQL_PWD="$DB_ROOT_PW" "$DB" mariadb -uroot -N -e \
    "SELECT ROUND(SUM(data_length + index_length) / 1e6, 1) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'tentacle'"
}

cmd_migrate() {
  ensure_dir; load_secrets; new_run migrate
  echo "${SLOW:-normal}" > "$RUN/mode.txt"
  # Deux relevés « avant », à 20 s d'écart : une route qui change d'elle-même sous la 1.24 (reco
  # reconstruite, horloge) est instable, et ne compte pas comme un écart de la migration.
  node "$HERE/apiSurvey.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$RUN/api-before-1.json" >/dev/null
  sleep 20
  node "$HERE/apiSurvey.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$RUN/api-before.json"
  node "$HERE/compareSurvey.mjs" "$RUN/api-before-1.json" "$RUN/api-before.json" "$RUN/api-volatile.json" > /dev/null || true
  data_listing "$RUN/data-before.txt"
  mariadb_size > "$RUN/mariadb-size-mb.txt"
  eng image inspect --format '{{.Size}}' "$REF_IMAGE" > "$RUN/image-ref-bytes.txt"
  eng image inspect --format '{{.Size}}' "$NEW_IMAGE" > "$RUN/image-new-bytes.txt"
  node "$HERE/watchMigration.mjs" "$BASE" "$(token user)" "$RUN/watch.json" --until ready --timeout 1800 > "$RUN/watch-summary.json" &
  local watch=$!
  sleep 1
  stop_tentacle
  # MariaDB figée, aucun serveur ne tourne : son empreinte AVANT la migration. Le temps du relevé
  # s'ajoute à la coupure mesurée ; il est noté à part et retranché dans le rapport.
  local c0; c0=$(date +%s%N)
  mariadb_checksums "$RUN/mariadb-before.txt"
  echo $((($(date +%s%N) - c0) / 1000000)) > "$RUN/checksum-ms.txt"
  start_tentacle "$NEW_IMAGE" "$SLOW"
  wait "$watch"
  memory_of > "$RUN/memory-after-boot.txt"
  local t1=$SECONDS
  wait_cache_done
  echo "$((SECONDS - t1))" > "$RUN/cache-copy-seconds.txt"
  data_listing "$RUN/data-after.txt"
  curl -fsS -H "Authorization: Bearer $(token admin)" "$BASE/api/admin/database/migration" > "$RUN/migration-summary.json"
  chmod 600 "$RUN/migration-summary.json"
  node "$HERE/apiSurvey.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$RUN/api-after.json"
  node "$HERE/compareSurvey.mjs" "$RUN/api-before.json" "$RUN/api-after.json" "$RUN/api-detail.json" "$RUN/api-volatile.json" > "$RUN/api-compare.md" || true
  # BENCH_VIGIE_UPDATE=0 : Vigie 1.24.1 reste refusé (son encadré et son bouton, vus au navigateur).
  if [ "$VIGIE" = "1" ] && [ "${BENCH_VIGIE_UPDATE:-1}" = "1" ]; then
    # Vigie 1.24.1 refusé tel quel (SQLite non déclaré), la 1.25.0 proposée, puis mise à jour.
    node "$HERE/vigieInstall.mjs" "$BASE" "$BENCH_DIR/tokens.json" - state > "$RUN/vigie-before-update.json"
    node "$HERE/vigieInstall.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$REG_URL/registry.json" marketplace > "$RUN/vigie-offered.json"
    node "$HERE/vigieInstall.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$REG_URL/registry.json" update > "$RUN/vigie-update.txt"
    node "$HERE/vigieInstall.mjs" "$BASE" "$BENCH_DIR/tokens.json" - state > "$RUN/vigie-after-update.json"
    node "$HERE/apiSurvey.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$RUN/api-after-vigie.json"
    node "$HERE/compareSurvey.mjs" "$RUN/api-before.json" "$RUN/api-after-vigie.json" "$RUN/api-detail-vigie.json" "$RUN/api-volatile.json" > "$RUN/api-compare-vigie.md" || true
    # La même question sous la 1.25 : deux relevés à 20 s d'écart, même version. Une route instable
    # ici l'est d'elle-même (tri sans départage, horloge), pas par la migration.
    sleep 20
    node "$HERE/apiSurvey.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$RUN/api-after-vigie-2.json" >/dev/null
    node "$HERE/compareSurvey.mjs" "$RUN/api-after-vigie.json" "$RUN/api-after-vigie-2.json" "$RUN/api-stability-after.json" > "$RUN/api-stability-after.md" || true
  fi
  copy_sqlite "$RUN/tentacle-copy.db"
  wait_http "$BASE/api/health" 120
  node "$HERE/dbCompare.mjs" "$HOST_SOURCE_URL" "$RUN/tentacle-copy.db" "$RUN/db-compare.json" > "$RUN/db-compare.md"
  rm -f "$RUN/tentacle-copy.db"*
  mariadb_checksums "$RUN/mariadb-after.txt"
  if diff -q "$RUN/mariadb-before.txt" "$RUN/mariadb-after.txt" >/dev/null; then echo "intacte" > "$RUN/mariadb-intact.txt"; else echo "MODIFIÉE" > "$RUN/mariadb-intact.txt"; fi
  pristine_compare
  sleep 30
  memory_of > "$RUN/memory-idle.txt"
  node "$HERE/benchReport.mjs" "$RUN" > "$RUN/report.md"
  log "rapport : $RUN/report.md"
}

# Revenir à la 1.24.0 sur la même MariaDB (avant un nouveau passage). `--unmigrated` efface
# AUSSI la base SQLite du dossier de données : le prochain `migrate` repart d'une vraie migration.
cmd_ref() {
  ensure_dir; load_secrets
  stop_tentacle
  [ "${1:-}" = "--unmigrated" ] && reset_to_unmigrated
  start_tentacle "$REF_IMAGE"
  wait_http "$BASE/api/health" 300
  log "Tentacle 1.24.0 de nouveau en service — $BASE"
}

# Le relevé « avant » de référence : celui du dernier `migrate`, pris JUSTE avant la bascule
# (la 1.24 change d'elle-même entre-temps : reco reconstruite), sinon celui de `up`.
reference_before() {
  if [ -f "$BENCH_DIR/runs/last-migrate/api-before.json" ]; then echo "$BENCH_DIR/runs/last-migrate/api-before.json"; else echo "$BENCH_DIR/api-before.json"; fi
}
reference_volatile() {
  [ -f "$BENCH_DIR/runs/last-migrate/api-volatile.json" ] && echo "$BENCH_DIR/runs/last-migrate/api-volatile.json"
}

reset_to_unmigrated() {
  eng run --rm -v "$VOL:/data" --entrypoint sh "$REF_IMAGE" -c \
    'rm -f /data/tentacle.db /data/tentacle.db-wal /data/tentacle.db-shm /data/tentacle.db.migrating* /data/db-migration-status.json /data/db-migration.lock' >/dev/null
}

cmd_kill() {
  ensure_dir; load_secrets; new_run kill
  stop_tentacle; reset_to_unmigrated
  mariadb_checksums "$RUN/mariadb-before.txt"
  # Sans politique de redémarrage le temps du test : on regarde le dossier entre l'arrêt et la reprise.
  eng run -d --name "$TC" --network "$NET" --cpus 0.25 -p "127.0.0.1:$PORT:3000" -e TZ=Europe/Paris \
    $([ "$WEB_UI" = "off" ] && echo "-e TENTACLE_WEB_UI=off") -v "$VOL:/app/apps/backend/data" "$NEW_IMAGE" >/dev/null
  node "$HERE/watchMigration.mjs" "$BASE" "$(token user)" "$RUN/watch-kill.json" --kill-at "${BENCH_KILL_AT:-20}" --kill-cmd "$ENGINE kill $TC" > "$RUN/kill-summary.json"
  data_listing "$RUN/data-after-kill.txt"
  mariadb_checksums "$RUN/mariadb-after-kill.txt"
  if diff -q "$RUN/mariadb-before.txt" "$RUN/mariadb-after-kill.txt" >/dev/null; then echo "intacte" > "$RUN/mariadb-intact.txt"; else echo "MODIFIÉE" > "$RUN/mariadb-intact.txt"; fi
  eng rm -f "$TC" >/dev/null
  node "$HERE/watchMigration.mjs" "$BASE" "$(token user)" "$RUN/watch-resume.json" --until ready --timeout 1800 > "$RUN/resume-summary.json" &
  local watch=$!
  start_tentacle "$NEW_IMAGE"
  wait "$watch"
  wait_cache_done || true
  data_listing "$RUN/data-after-resume.txt"
  node "$HERE/apiSurvey.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$RUN/api-after.json"
  # shellcheck disable=SC2046
  node "$HERE/compareSurvey.mjs" "$(reference_before)" "$RUN/api-after.json" "$RUN/api-detail.json" $(reference_volatile) > "$RUN/api-compare.md" || true
  node "$HERE/benchReport.mjs" "$RUN" > "$RUN/report.md"
  log "rapport : $RUN/report.md"
}

cmd_rollback() {
  ensure_dir; load_secrets; new_run rollback
  stop_tentacle; start_tentacle "$REF_IMAGE"; wait_http "$BASE/api/health" 300
  node "$HERE/rollbackProbe.mjs" "$BASE" "$BENCH_DIR/tokens.json" write
  stop_tentacle; start_tentacle "$NEW_IMAGE"; wait_http "$BASE/api/config" 300
  node "$HERE/rollbackProbe.mjs" "$BASE" "$BENCH_DIR/tokens.json" status > "$RUN/status-after-rollback.json"
  node "$HERE/watchMigration.mjs" "$BASE" "$(token user)" "$RUN/watch-remigrate.json" --until ready --timeout 1800 > "$RUN/remigrate-summary.json" &
  local watch=$!
  sleep 1
  node "$HERE/rollbackProbe.mjs" "$BASE" "$BENCH_DIR/tokens.json" remigrate
  wait "$watch"
  wait_cache_done || true
  node "$HERE/rollbackProbe.mjs" "$BASE" "$BENCH_DIR/tokens.json" status > "$RUN/status-after-remigrate.json"
  node "$HERE/rollbackProbe.mjs" "$BASE" "$BENCH_DIR/tokens.json" check > "$RUN/check-after-remigrate.json" || true
  data_listing "$RUN/data-after-remigrate.txt"
  node "$HERE/benchReport.mjs" "$RUN" > "$RUN/report.md"
  log "rapport : $RUN/report.md"
}

cmd_down() {
  for c in "$TC" "$DB" "$REG"; do eng rm -f "$c" >/dev/null 2>&1 || true; done
  eng volume rm -f "$VOL" "$DBVOL" >/dev/null 2>&1 || true
  if [ "${1:-}" = "--all" ]; then
    for c in $(eng ps -a --format '{{.Names}}' | grep '^sqlbench-jellyfin' || true); do eng rm -f "$c" >/dev/null 2>&1 || true; done
    for v in $(eng volume ls --format '{{.Name}}' | grep '^sqlbench-jf' || true); do eng volume rm -f "$v" >/dev/null 2>&1 || true; done
    eng network rm "$NET" >/dev/null 2>&1 || true
  fi
  log "banc retiré${1:+ (tout)}"
}
