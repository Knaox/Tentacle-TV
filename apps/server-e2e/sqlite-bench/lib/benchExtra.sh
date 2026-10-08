# shellcheck shell=bash
# Les scénarios de charge (§ 8.7) : des écritures PARALLÈLES par l'API sur la base SQLite à une
# connexion, serveur au repos PUIS pendant la copie du cache TMDB en fond (le pire moment, sur
# ½ cœur) — latences p50 / p95 / p99 par geste, erreurs, et aucune SQLITE_BUSY au journal.

busy_count() { eng logs "$TC" 2>&1 | grep -cE "SQLITE_BUSY|database is locked" || true; }

cmd_load() {
  ensure_dir; load_secrets; new_run load
  BENCH_RATE_LIMIT="${BENCH_RATE_LIMIT:-10000000}"
  {
    echo "# Banc SQLite — charge en écritures parallèles"
    echo
  } > "$RUN/report.md"
  # 1. La 1.25 en service, au repos (base déjà migrée : elle démarre sans migrer).
  stop_tentacle; start_tentacle "$NEW_IMAGE"
  wait_http "$BASE/api/config" 300
  wait_cache_done || true
  node "$HERE/loadTest.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$RUN/load-settled.json" --seconds "${BENCH_LOAD_SECONDS:-60}" --workers "${BENCH_LOAD_WORKERS:-16}" > /dev/null
  echo "SQLITE_BUSY / database is locked au journal : $(busy_count)" > "$RUN/busy-settled.txt"
  # 2. Pendant la copie du cache en fond : une vraie migration refaite, serveur sur ½ cœur.
  stop_tentacle
  reset_to_unmigrated
  start_tentacle "$NEW_IMAGE" slow
  local end=$((SECONDS + 600))
  until curl -fsS -H "Authorization: Bearer $(token user)" -o /dev/null "$BASE/api/preferences" 2>/dev/null; do
    [ $SECONDS -lt $end ] || die "la 1.25 ne sert pas après la migration"; sleep 0.5
  done
  node "$HERE/loadTest.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$RUN/load-during-copy.json" --seconds "${BENCH_LOAD_SECONDS:-45}" --workers "${BENCH_LOAD_WORKERS:-16}" > /dev/null
  curl -fsS -H "Authorization: Bearer $(token admin)" "$BASE/api/admin/database/migration" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(`${j.cache.phase} ${j.cache.percent}`)})' > "$RUN/cache-at-end.txt" || true
  echo "SQLITE_BUSY / database is locked au journal : $(busy_count)" > "$RUN/busy-during-copy.txt"
  wait_cache_done || true
  # 3. Même ½ cœur, copie FINIE : ce qui revient à la copie, et ce qui revient au ½ cœur.
  node "$HERE/loadTest.mjs" "$BASE" "$BENCH_DIR/tokens.json" "$RUN/load-slow-after-copy.json" --seconds "${BENCH_LOAD_SECONDS:-45}" --workers "${BENCH_LOAD_WORKERS:-16}" > /dev/null
  echo "SQLITE_BUSY / database is locked au journal : $(busy_count)" > "$RUN/busy-slow-after-copy.txt"
  # Le conteneur repart à pleine vitesse, et avec la limite de débit d'origine, pour la suite du banc.
  BENCH_RATE_LIMIT=""
  stop_tentacle; start_tentacle "$NEW_IMAGE"; wait_http "$BASE/api/health" 300
  node "$HERE/loadReport.mjs" "$RUN" >> "$RUN/report.md"
  log "rapport : $RUN/report.md"
}
