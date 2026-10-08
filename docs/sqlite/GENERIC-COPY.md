# Copie générique des tables d'extension (MariaDB → SQLite)

> Fait foi pour la migration du serveur (`apps/backend/src/dbMigration/`) ET pour les extensions
> qui retrouvent leurs tables recopiées (Vigie : `seer_*`). Toute retouche de la copie se reporte
> ici, et inversement. Rédigé le 2026-10-08 (serveur 1.25.0).

Une table de la source qui n'est ni du cœur (modèles de `schema.prisma`, `core_migrations`,
`plugin_migrations`) ni une ancienne table du cœur abandonnée est une table d'EXTENSION : elle est
recopiée **entière** — toutes ses lignes, aucun tri, aucun filtre — même d'une extension que le
serveur ne connaît pas. La copie la crée elle-même, avant d'y écrire, avec la forme ci-dessous ;
une extension la RECONNAÎT ensuite par ses migrations (`CREATE … IF NOT EXISTS`), sans rien
recréer. Le ménage (tables mortes) est l'affaire des migrations de l'extension, jamais de la copie.

## Types déclarés

| MariaDB | SQLite déclaré | Valeur copiée |
|---|---|---|
| `TINYINT`, `SMALLINT`, `MEDIUMINT`, `INT`, `BIGINT`, `YEAR`, `BIT` (dont `TINYINT(1)`) | `INTEGER` | entier (`BIT` → entier ; un BIGINT hors de ±2⁵³ reste exact) |
| `DECIMAL(p,s)`, `NUMERIC` | `REAL` | nombre (`8.500` → `8.5`) |
| `FLOAT`, `DOUBLE`, `REAL` | `REAL` | nombre |
| `DATETIME(n)`, `TIMESTAMP(n)` | `DATETIME` | **INTEGER, millisecondes depuis 1970, UTC** (`docs/sqlite/DECISION.md` § 2) |
| `DATE` (sans heure) | `TEXT` | `YYYY-MM-DD` tel quel |
| `TIME` | `TEXT` | `HH:MM:SS[.f]` tel quel |
| `CHAR(n)`, `VARCHAR(n)`, `*TEXT`, `ENUM`, `SET`, `JSON` (= `LONGTEXT`) | `TEXT` | le texte, octet pour octet (le JSON n'est ni relu ni réécrit) |
| `*BLOB`, `BINARY`, `VARBINARY` | `BLOB` | les octets |

- `DATETIME` déclaré : affinité NUMERIC, l'entier est rangé en INTEGER ; `$queryRaw` de Prisma
  rend une `Date` pour une colonne ainsi déclarée.
- `DECIMAL` → `REAL`, pas `DECIMAL` : une colonne déclarée `DECIMAL` reviendrait de `$queryRaw`
  en objet `Decimal`. Les valeurs de Vigie (popularité, note) n'ont pas besoin d'exactitude décimale.
- `DATE` → texte : une date sans heure n'a pas de fuseau ; en millisecondes elle deviendrait
  « minuit UTC » et pourrait glisser d'un jour à l'affichage. Le texte `YYYY-MM-DD` se trie et se
  compare correctement. (Vigie n'en a aucune : ses dates seules sont des `CHAR(10)`.)
- Date « zéro » de MariaDB (`0000-00-00 …`) : `NULL` si la colonne l'accepte, sinon `0`
  (1970-01-01) ; le rapport de migration en donne le nombre par colonne, jamais la ligne.

## Colonnes, clés, index

- Mêmes noms de colonnes, même ordre. `NOT NULL` recopié.
- **Clé primaire** recopiée : `PRIMARY KEY (a, b)` en contrainte de table (simple ou composée,
  ex. `seer_tmdb_cache (media_type, tmdb_id)`). Un entier `AUTO_INCREMENT` seul en clé devient
  `INTEGER PRIMARY KEY AUTOINCREMENT` (la suite des valeurs continue après la plus grande copiée).
- **Index** recopiés sous **leur nom MariaDB** (`idx_seer_req_user`, `idx_tmdbc_expires`…),
  `UNIQUE` gardé, mêmes colonnes dans le même ordre. Un nom d'index déjà pris dans la base (les
  noms sont globaux en SQLite, par table en MariaDB) reçoit le préfixe `<table>_`.
- **DEFAULT** : un littéral (nombre, chaîne) est recopié ; `CURRENT_TIMESTAMP` / `NOW()` sur une
  colonne de date devient `(CAST(unixepoch('subsec') * 1000 AS INTEGER))` — un ENTIER, jamais du
  texte ; toute autre expression est omise. Une extension qui NOMME ses colonnes de date à
  l'INSERT (règle de DECISION.md) n'en dépend jamais.
- **Omis**, et c'est voulu : `ON UPDATE CURRENT_TIMESTAMP` (l'extension pose la date elle-même),
  `CHECK (json_valid(…))`, `ENGINE`, `CHARSET`, `COLLATE` (la casse se normalise à l'entrée,
  DECISION.md § 6).

## Le fuseau des dates

Prisma écrit l'UTC. Le SQL brut d'une extension (`NOW()`, `CURRENT_TIMESTAMP`, `DATE_ADD(NOW(), …)`,
défauts de colonne) écrit dans le **fuseau de la session MariaDB** — `@@session.time_zone`, qui vaut
`@@system_time_zone` quand il dit `SYSTEM`. Les images Docker de MariaDB sont en UTC ; une MariaDB
installée sur un hôte réglé sur `Europe/Paris` ne l'est pas.

La copie lit le fuseau de la source, puis lit en UTC (`SET time_zone = '+00:00'`) :

- `TIMESTAMP` : MariaDB le range en UTC, il ressort donc exact ;
- `DATETIME` d'une colonne **« session »** : converti par `CONVERT_TZ(col, <fuseau source>, '+00:00')`
  (heure d'été comprise ; l'heure inexistante du printemps avance, l'heure ambiguë de l'automne
  prend l'heure d'hiver) ;
- `DATETIME` d'une colonne **« UTC »** : pris tel quel.

| Colonnes | Fuseau |
|---|---|
| Tables du cœur (Prisma) | UTC |
| `content_claims.expiresAt` (table du cœur écrite par Vigie avec `DATE_ADD(NOW(3), …)` ; depuis Vigie 1.25, en millisecondes calculées en JavaScript) | session |
| `seer_user_settings.jellyseerr_last_sync`, `seer_tmdb_cache.expires_at` (Date JS liée) | UTC |
| Toute autre colonne de date d'une table `seer_*`, y compris les colonnes écrites des deux façons (`seer_requests.sent_at`, `completed_at`, `seer_cleanup_queue.next_retry_at`) | session |
| Table d'une extension inconnue | session (le SQL brut écrit `NOW()`) |

Source en UTC (le cas des piles Docker et de la production mesurée) : aucune conversion, valeurs
identiques. Le rapport dit si une conversion a eu lieu. `CONVERT_TZ` ne convertit pas une date hors de
la plage de `TIMESTAMP` (après 2038 avant MariaDB 11.5) : elle garde alors son heure locale — au plus
quelques heures d'écart sur une échéance lointaine.

## Ce que la copie refuse

- Une table source HORS cœur dont le nom, en minuscules, est celui d'une table de la cible (tables
  du cœur, `core_migrations`, `plugin_migrations`, `sqlite_*`) : refusée et signalée — sinon une
  source pourrait faire croire des migrations déjà faites.
- Deux tables source qui ne diffèrent que par la casse : refusées et signalées (SQLite ignore la
  casse des noms de tables).
