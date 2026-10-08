#!/usr/bin/env bash
# Banc réel de la migration MariaDB → SQLite (serveur 1.25, § 8), rejouable en UNE commande :
#
#   bench.sh image        construit l'image à éprouver depuis HEAD (serveur en 1.25.0 dans l'export seulement)
#   bench.sh vigie-build  construit Vigie 1.24.1 (tag) et 1.25.0 (feat/sqlite) depuis leurs SOURCES,
#                         et le registre local qui les sert (rien de publié n'est téléchargé)
#   bench.sh up           réseau interne, Jellyfin du banc (vrais fichiers), MariaDB chargée de la
#                         copie NEUTRALISÉE, Tentacle 1.24.0 — source dans data/database.json et
#                         interface web coupée, comme la pile de Damien —, Vigie 1.24.1 installé ;
#                         jetons pris (administrateur, compte de test, TV jumelée) ; relevé « avant »
#   bench.sh ref [--unmigrated]  la pile remise sur 1.24.0 (même MariaDB) ; --unmigrated efface la base
#                         SQLite : le prochain `migrate` refait une vraie migration
#   bench.sh migrate      la même pile passée sur l'image à éprouver : coupure vue par un client,
#                         écran d'attente, durée, disque, mémoire ; relevé « après » avec les MÊMES
#                         jetons, comparaison de l'API et de la base ; MariaDB intacte
#   bench.sh kill         une migration tuée en pleine copie : MariaDB intacte, reprise jusqu'au bout
#   bench.sh rollback     retour à 1.24.0, une écriture, retour à la 1.25 : divergence dite ;
#                         « Migrer à nouveau » la reprend
#   bench.sh load         écritures parallèles, au repos puis pendant la copie du cache : latences, SQLITE_BUSY
#   bench.sh stacks       la mise à jour depuis les piles livrées en 1.24.0 (tentacle-full, tentacle-db) :
#                         image seule, lignes du guide de retrait, nouvelle pile avant la migration
#   bench.sh fresh        l'installation neuve sur les deux piles d'aujourd'hui (BENCH_FRESH_KEEP=full|only :
#                         la laisser en service pour le navigateur)
#   bench.sh external     un compte SELECT seul, puis une MySQL 8.4, comme sources
#   bench.sh old          une base posée par l'image 1.23.0, Famille v1 : migrée, vérifiée contre attendu.txt
#   bench.sh down [--all] retire ce que le banc a créé (--all : Jellyfin et réseau compris)
#
# Variables (défauts entre crochets) :
#   BENCH_DIR [~/.cache/tentacle-test/sqlite-migration/bench3]   relevés et secrets, 0700
#   BENCH_DUMP   la copie NEUTRALISÉE (jamais l'original : son en-tête est vérifié)
#   BENCH_ORIGINAL  l'export d'origine, seulement LU pour produire la copie neutralisée si elle manque
#   BENCH_USERS  les comptes du Jellyfin du banc (jellyfinSetup.mjs)
#   BENCH_IMAGE [localhost/tentacle-tv:sqlite-bench]  BENCH_REF_IMAGE [ghcr.io/knaox/tentacle-tv:v1.24.0]
#   BENCH_ENGINE [podman]  BENCH_SOURCE [file|env]  BENCH_WEB_UI [off|on]
#   BENCH_SLOW=1 (½ cœur) | nas (NAS lent simulé : ½ cœur, disque à 30 Mo/s et 400 IOPS)
#   BENCH_VIGIE [1]  BENCH_VIGIE_UPDATE [1]  BENCH_MEDIA  BENCH_KILL_AT [20] (%)
#   BENCH_JELLYFIN [10.11|12.1]  un Jellyfin du banc par version (un seul en service : il porte le nom
#                que désigne la copie), ses comptes et SA copie neutralisée (prod-neutralized-12.1.sql)
# Prérequis : podman (ou docker), node ≥ 22.13, curl ; les images présentes localement (le réseau
# du banc n'a pas Internet).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="$HOME/.cache/tentacle-test/sqlite-migration"
ENGINE="${BENCH_ENGINE:-podman}"
BENCH_DIR="${BENCH_DIR:-$CACHE/bench3}"
JF_VERSION="${BENCH_JELLYFIN:-10.11}"
# Une copie neutralisée par Jellyfin : elle est liée aux comptes de CE Jellyfin.
if [ "$JF_VERSION" = "10.11" ]; then JF_SUFFIX=""; else JF_SUFFIX="-$JF_VERSION"; fi
DUMP="${BENCH_DUMP:-$CACHE/prod-neutralized$JF_SUFFIX.sql}"
USERS="${BENCH_USERS:-$CACHE/bench-users-$JF_VERSION.json}"
MEDIA="${BENCH_MEDIA:-$CACHE/media}"
REF_IMAGE="${BENCH_REF_IMAGE:-ghcr.io/knaox/tentacle-tv:v1.24.0}"
NEW_IMAGE="${BENCH_IMAGE:-localhost/tentacle-tv:sqlite-bench}"
MARIADB_IMAGE="${BENCH_MARIADB_IMAGE:-docker.io/library/mariadb:10.11}"
JF_IMAGE="docker.io/jellyfin/jellyfin:$JF_VERSION"
VIGIE_REPO="${BENCH_VIGIE_REPO:-$HOME/Desktop/Projects-Local/Tentacle-Plugin-Seer}"
VIGIE_SQLITE="${BENCH_VIGIE_SQLITE:-$CACHE/wt/vigie}"
SOURCE="${BENCH_SOURCE:-file}"
WEB_UI="${BENCH_WEB_UI:-off}"
VIGIE="${BENCH_VIGIE:-1}"
SLOW="${BENCH_SLOW:-}"
case "$SLOW" in 1) SLOW=slow ;; nas) ;; *) SLOW="" ;; esac

NET="tentacle-sqlbench"
JF_HOST="sqlbench-jellyfin"       # le nom que porte la copie neutralisée (adresse de Jellyfin)
JF="sqlbench-jellyfin$JF_SUFFIX"; JF_VOL="sqlbench-jf$JF_SUFFIX"   # un conteneur par version
JF_PORT="${BENCH_JF_PORT:-47496}"
DB="sqlbench3-mariadb";  DBVOL="sqlbench3-mariadb-data";  DB_PORT="${BENCH_DB_PORT:-47407}"
TC="sqlbench3-tentacle"; VOL="sqlbench3-tentacle-data";   PORT="${BENCH_PORT:-47480}"
REG="sqlbench3-registry"; REG_URL="http://$REG:8080"
BASE="http://127.0.0.1:$PORT"

# shellcheck source=lib/benchCommon.sh
. "$HERE/lib/benchCommon.sh"
# shellcheck source=lib/benchScenarios.sh
. "$HERE/lib/benchScenarios.sh"
# shellcheck source=lib/benchStacks.sh
. "$HERE/lib/benchStacks.sh"
# shellcheck source=lib/benchExtra.sh
. "$HERE/lib/benchExtra.sh"
# shellcheck source=lib/benchSources.sh
. "$HERE/lib/benchSources.sh"

case "${1:-}" in
  image) cmd_image ;;
  vigie-build) cmd_vigie_build ;;
  up) cmd_up ;;
  ref) cmd_ref "${2:-}" ;;
  migrate) cmd_migrate ;;
  kill) cmd_kill ;;
  rollback) cmd_rollback ;;
  load) cmd_load ;;
  stacks) cmd_stacks ;;
  fresh) cmd_fresh ;;
  external) cmd_external ;;
  old) cmd_old ;;
  down) cmd_down "${2:-}" ;;
  all) cmd_up && cmd_migrate && cmd_kill && cmd_rollback ;;
  *) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
