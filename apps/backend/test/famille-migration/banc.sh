#!/bin/zsh
# Banc de la migration v1 → v2 de la Famille (docs/FAMILLE.md, « La migration
# v1 → v2 ») : le bloc v2 de core-init.sql, tel qu'il est AUJOURD'HUI, passe sur
# une base v1 qui porte chaque cas interdit (familles croisées, orpheline,
# membre de deux familles, chaîne, invitations impossibles), deux fois — la
# seconde ne doit rien changer —, sur MariaDB 11 (la prod) et MySQL 8.0 (la
# syntaxe de la base de dev, MySQL 9.6). Résultat comparé à `attendu.txt`.
#
#   zsh apps/backend/test/famille-migration/banc.sh
#
# Docker requis (images mariadb:11 et mysql:8.0) ; conteneurs jetables
# `famille-migration-*` (préfixe : FAMILLE_BANC_PREFIX), supprimés à la fin.
set -u
HERE="${0:A:h}"
INIT="$HERE/../../prisma/core-init.sql"
WORK="$(mktemp -d)"
PW="banc-$RANDOM$RANDOM"
P="${FAMILLE_BANC_PREFIX:-famille-migration}"
awk '/^-- La Famille v2 : le créateur d.un invité/{f=1} f{print} /^DEALLOCATE PREPARE fm_user_key_stmt;/{exit}' "$INIT" > "$WORK/v2.sql"
[ -s "$WORK/v2.sql" ] || { echo "bloc v2 introuvable dans core-init.sql"; exit 1; }
stop() { docker rm -f $P-maria $P-mysql >/dev/null 2>&1; }
trap 'stop; rm -rf "$WORK"' EXIT
stop
docker run -d --name $P-maria -e MARIADB_ROOT_PASSWORD="$PW" -e MARIADB_DATABASE=banc mariadb:11 >/dev/null || exit 1
docker run -d --name $P-mysql -e MYSQL_ROOT_PASSWORD="$PW" -e MYSQL_DATABASE=banc mysql:8.0 >/dev/null || exit 1
ready() { docker exec "$1" "$2" -uroot -p"$PW" -e "SELECT 1" banc >/dev/null 2>&1; }
for i in {1..150}; do ready $P-maria mariadb && ready $P-mysql mysql && break; sleep 1; done
run() { docker exec -i "$1" "$2" -uroot -p"$PW" -N -B banc < "$3" 2>&1 | grep -v "Using a password"; }
failed=0
for engine in maria:mariadb mysql:mysql; do
  c="$P-${engine%%:*}"; cli="${engine##*:}"
  run $c $cli "$HERE/v1-schema.sql" > "$WORK/schema.txt"
  run $c $cli "$HERE/fixtures-v1.sql" > "$WORK/donnees.txt"
  run $c $cli "$WORK/v2.sql" > "$WORK/migration.txt"
  run $c $cli "$HERE/check.sql" > "$WORK/apres.txt"
  run $c $cli "$WORK/v2.sql" > "$WORK/rejeu.txt"
  run $c $cli "$HERE/check.sql" > "$WORK/apres-rejeu.txt"
  for step in schema donnees migration rejeu; do
    if [ -s "$WORK/$step.txt" ]; then echo "✗ ${engine%%:*} : sortie inattendue ($step)"; cat "$WORK/$step.txt"; failed=1; fi
  done
  if diff -u "$HERE/attendu.txt" "$WORK/apres.txt"; then echo "✓ ${engine%%:*} : migration conforme"; else failed=1; fi
  if diff -u "$WORK/apres.txt" "$WORK/apres-rejeu.txt" >/dev/null; then echo "✓ ${engine%%:*} : rejeu sans effet"; else echo "✗ ${engine%%:*} : le rejeu a changé la base"; failed=1; fi
done
exit $failed
