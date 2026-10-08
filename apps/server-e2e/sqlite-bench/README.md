# Banc de la migration MariaDB → SQLite (serveur 1.25)

Le banc réel de la migration, rejouable en une commande. Il ne contient AUCUNE donnée : il lit
une copie **neutralisée** d'un export de production, produite par `neutralize.mjs`, et travaille
dans `~/.cache/tentacle-test/sqlite-migration/bench3/` (0700). Rien de ce qu'il produit n'entre
dans le dépôt.

## Règles (non négociables)

- **Jamais l'original** : `bench.sh` refuse tout fichier sans l'en-tête de `neutralize.mjs`, et
  rien sous `Téléchargements`. L'original n'est que LU, une fois, par `neutralize.mjs`.
- **Réseau interne** (`tentacle-sqlbench`, `--internal`) : ni Internet, ni le réseau local. Les
  images doivent donc être présentes localement, et les extensions viennent d'un registre LOCAL.
- **Ce qui sort est anonyme** : `report.md` ne dit que des durées, des tailles, des comptes, des
  noms de tables et de routes. Les relevés complets (réponses de l'API, jetons) restent en 0600.

## Préparer (une fois)

```bash
# 1. Le Jellyfin du banc et ses comptes (vrais fichiers dans BENCH_MEDIA) — bench.sh up le fait aussi.
# 2. La copie neutralisée, liée aux comptes de CE Jellyfin :
node neutralize.mjs <export-de-production.sql> <bench-users.json> <copie-neutralisée.sql>
# 3. L'image à éprouver, construite depuis HEAD (versions.json → server en 1.25.0, dans l'export seulement) :
./bench.sh image
# 4. Vigie 1.24.1 et 1.25.0 depuis leurs sources, et le registre local :
./bench.sh vigie-build
```

## Rejouer

```bash
./bench.sh image     # l'image à éprouver, depuis HEAD (serveur en 1.25.0 dans l'export seulement)
./bench.sh up        # 1.24.0 sur la copie neutralisée, Vigie 1.24.1, jetons, relevé « avant »
./bench.sh migrate   # la bascule sur l'image à éprouver ; relevés, comparaisons, report.md
./bench.sh kill      # une migration tuée en pleine copie, puis sa reprise
./bench.sh rollback  # retour à 1.24.0, une écriture, retour à la 1.25 : divergence, « Migrer à nouveau »
./bench.sh down      # tout retirer (--all : Jellyfin et réseau compris)
./bench.sh all       # up, migrate, kill, rollback à la suite
```

Et à part, chacun sur ses propres conteneurs (préfixe `sqlbench3-`) :

```bash
./bench.sh load      # écritures parallèles (16 clients) : au repos, pendant la copie du cache, ½ cœur
./bench.sh stacks    # la mise à jour depuis les piles livrées en 1.24.0 (image seule, guide, nouvelle pile)
./bench.sh fresh     # l'installation neuve sur tentacle-full et tentacle-only : aucune étape de base
./bench.sh external  # un compte SELECT seul, puis MySQL 8.4 (image mysql:8.4 présente localement)
./bench.sh old       # une base posée par l'image 1.23.0, puis la Famille v1 contre attendu.txt
```

Jellyfin 12.1 : `BENCH_JELLYFIN=12.1 BENCH_ORIGINAL=<export> ./bench.sh up` monte un second Jellyfin du
banc (un seul en service à la fois : il porte le nom que désigne la copie), ses comptes, et SA copie
neutralisée (`prod-neutralized-12.1.sql`) — puis `BENCH_JELLYFIN=12.1 ./bench.sh migrate`.

Chaque scénario écrit `runs/<date>-<scénario>/report.md` : la coupure vue par une application
(route authentifiée, relevée toutes les 200 ms), l'écran d'attente, la durée de la migration et
de la copie du cache en fond, la taille de `tentacle.db`, la mémoire, la comparaison de l'API
(mêmes jetons avant et après : administrateur, compte de test, TV jumelée) et celle de la base
(MariaDB contre une copie de `tentacle.db`, ligne par ligne, par un code indépendant de la
migration), et MariaDB intacte (`CHECKSUM TABLE` de toutes les tables).

Variables : voir l'en-tête de `bench.sh` (`BENCH_SOURCE=env` pour une source dans `DATABASE_URL`,
`BENCH_WEB_UI=on`, `BENCH_SLOW=1` pour voir l'écran d'attente au navigateur, `BENCH_JELLYFIN=12.1`…).

## Les outils

| Fichier | Rôle |
|---|---|
| `survey.mjs` | relevé d'un export (tables, volumes) — sans valeur |
| `neutralize.mjs` | la copie neutralisée (comptes remappés, secrets régénérés, textes remplacés, contrôle final) |
| `jellyfinSetup.mjs` | le Jellyfin du banc : assistant, comptes, bibliothèques, clé |
| `benchTokens.mjs` | les jetons pris AVANT la migration (dont une TV jumelée) |
| `apiSurvey.mjs` / `compareSurvey.mjs` | le relevé de l'API et sa comparaison anonyme |
| `dbCompare.mjs` | la comparaison indépendante MariaDB / SQLite |
| `watchMigration.mjs` | la bascule vue d'un client, et l'arrêt brutal au pourcentage voulu |
| `vigieRegistry.mjs` / `vigieInstall.mjs` | le registre local et l'installation de Vigie par l'API |
| `rollbackProbe.mjs` | l'écriture de la 1.24 et sa divergence |
| `loadTest.mjs` / `loadReport.mjs` | la charge en écritures parallèles et son rapport (latences, SQLITE_BUSY) |
| `stackEdit.mjs` | une pile livrée retouchée comme le dit le guide de retrait (ou à moitié : l'erreur de Compose) |
| `familyCheck.mjs` | la Famille d'une base v1 migrée, contre `attendu.txt` du banc Famille |
| `benchReport.mjs` | le rapport anonyme d'un passage |
