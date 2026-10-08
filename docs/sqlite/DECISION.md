# SQLite — note de décision (serveur 1.25.0)

> Mesuré le 2026-10-08 sur le poste de dev (Linux x64, 16 cœurs, Node 22.23, Prisma 6.19.2,
> disque btrfs). Banc jetable hors dépôt : 44 modèles du `schema.prisma` réel passés en
> `provider = "sqlite"`, DDL tiré de `prisma migrate diff`. Aucune donnée réelle n'y entre.
> Ce qui est FIGÉ ici le sera par des tests sur une vraie base, livrés avec le socle
> (`apps/backend/src/services/database/*.test.ts`) : chaque section nomme le sien.

## 1. Accès à SQLite : le moteur natif de Prisma, UNE connexion

**Décision : le moteur natif de Prisma (`prisma-client-js`, moteur « library »), URL
`file:<data>/tentacle.db?connection_limit=1&socket_timeout=15`. Pas de `driverAdapters`.**

| Critère (mesuré) | Natif, pool par défaut | **Natif, `connection_limit=1`** | `adapter-better-sqlite3` |
|---|---|---|---|
| Écriture HORS transaction pendant une transaction interactive annulée | attend, puis écrite | **attend, puis écrite** | **exécutée DANS la transaction et ANNULÉE avec elle** |
| 64 transactions interactives + 400 écritures en parallèle | 107 P1008 (35 s) | **0 erreur (82 ms)** | 0 erreur (108 ms) |
| idem, `busy_timeout` 30 s | 145 erreurs (243 s) | 0 erreur | — |
| 5 000 `create` successifs (`synchronous=NORMAL`) | — | **0,18 ms/écriture** | 0,25 ms |
| idem en `synchronous=FULL` (défaut du moteur) | 5,3 ms | 5,3 ms | — |
| 5 000 `findUnique` successifs / en parallèle | 0,40 / 0,40 s | 0,44 / 0,46 s | 0,65 / 0,37 s |
| `createMany` 5 000 lignes | 50 ms | 42 ms | 62 ms |
| Mémoire du processus en fin de banc | 560 Mo | 556 Mo | 709 Mo |

- **L'adaptateur better-sqlite3 est éliminé** : il n'a qu'une connexion, et son verrou ne
  sérialise QUE les transactions. Une requête ordinaire lancée pendant une transaction
  interactive s'exécute dedans : si la transaction échoue, l'écriture d'à côté disparaît, sans
  erreur. (Mesuré : `outsidePersisted: false`.) Sur un serveur où Vigie, la reco et les sockets
  écrivent en même temps, c'est une perte de données silencieuse. La variante sans moteur Rust
  (`engineType = "client"`) a le même adaptateur, le même défaut, et plus de mémoire (886 Mo).
- **Le pool par défaut du moteur natif est éliminé** : chaque connexion prend le verrou
  d'écriture par `BEGIN IMMEDIATE` (relevé dans le moteur) et le garde pendant les allers-retours
  JavaScript d'une transaction interactive. Les autres attendent `busy_timeout`, puis P1008.
  Allonger l'attente aggrave (243 s, 145 échecs).
- **Une seule connexion** : SQLite n'a qu'un écrivain de toute façon. Les requêtes du processus
  font la queue dans le pool de Prisma au lieu de se battre pour le verrou du fichier. Aucun
  `SQLITE_BUSY` ne peut plus naître DANS le processus ; il ne vient que d'un AUTRE processus
  (la CLI `tentacle db query`, en lecture seule ; un outil externe).
  Revers : une longue lecture retient les autres requêtes. Toute requête doit rester indexée et
  bornée, et une transaction interactive ne fait JAMAIS d'appel réseau (vérifié : aucune des 10
  `$transaction` du cœur n'en fait).
- **Image** : +0 Mo. Le moteur `libquery_engine-linux-musl-openssl-3.0.x` (17,5 Mo) est déjà
  dans l'image et porte SQLite 3.46.0. Aucun module natif de plus, rien à compiler sur alpine.
- **Windows (plus tard)** : `binaryTargets` accepte `"windows"` et Prisma livre
  `query_engine-windows.dll.node` (21 Mo), vérifié au `prisma generate`. Chemins par `path`.
- **Prisma 7** (moteur Rust retiré, adaptateurs obligatoires) : à reprendre ce jour-là, avec un
  adaptateur dont TOUTES les requêtes passent par le même verrou. Le format des dates ci-dessous
  reste le même avec `timestampFormat: "unixepoch-ms"` (mesuré : l'adaptateur écrit l'entier).

## 2. Les dates : millisecondes epoch, en INTEGER

**Décision : toute colonne `DateTime` contient un INTEGER, millisecondes depuis 1970 (UTC).
C'est le format du moteur natif ; il n'est pas réglable.**

Mesuré par `typeof()` après chaque écriture de Prisma : `create`, `createMany`, `upsert`,
`@updatedAt`, `@default(now())`, et une `Date` liée dans `$queryRaw` → `integer`. Le moteur
RELIT aussi l'ISO (`…Z`, `…+00:00`) et le texte `CURRENT_TIMESTAMP`, mais il les COMPARE mal :
en SQLite, un TEXT est toujours plus grand qu'un INTEGER. Mesuré : une ligne datée en texte de
l'an 2000 passe le filtre `createdAt > 2026-01-01`. Un entier en SECONDES est relu comme des
millisecondes (janvier 1970). **Un seul format, donc, et partout :**

- **SQL brut du cœur** : une date se LIE (`${date}` dans `$queryRaw`), jamais une chaîne.
  « Maintenant » en SQL : `CAST(unixepoch('subsec') * 1000 AS INTEGER)` (SQLite ≥ 3.42 ; le
  moteur embarque 3.46.0). Jamais `CURRENT_TIMESTAMP`, `datetime('now')`, `date('now')`.
- **Vigie et toute extension** : la même règle, par les aides de l'interface de stockage (§ 5
  du prompt). `iso8601` est à abandonner : seul `unixepoch-ms` est relu correctement par Prisma.
- **La copie depuis MariaDB** (tâche 3) écrit `Date.getTime()`, jamais une chaîne.
- **Le piège des défauts** : le DDL que génère Prisma garde `DEFAULT CURRENT_TIMESTAMP` (texte).
  Prisma ne s'en sert jamais (il envoie toujours la valeur, mesuré), mais un `INSERT` brut qui
  omet la colonne écrirait du TEXTE. Le remplacer par un défaut entier n'est pas possible sans
  dérive : `dbgenerated(...)` est toujours vu comme différent par `migrate diff` (mesuré, avec
  et sans parenthèses ; sans, le DDL est même invalide). Donc : **un `INSERT` brut nomme
  toujours ses colonnes de date**, et un test le vérifie pour le cœur.
- Lecture brute : `$queryRaw` rend une `Date` pour une colonne déclarée `DATETIME` et un
  `bigint` pour un `COUNT(*)` ou un entier calculé → `Number()` avant de répondre.

Test qui fige : `sqliteDates.test.ts` (vraie base) — `typeof` = `integer` après chaque forme
d'écriture, et la comparaison liée.

## 3. Schéma et mises à niveau : des migrations versionnées, sans CLI

- `prisma/migrations-sqlite/NNNN_nom.sql`, générées par `prisma migrate diff` et COMMITÉES.
  Nouvelle migration (après une retouche de `schema.prisma`) :
  `pnpm --filter @tentacle-tv/backend db:migration <nom>` — construit une base temporaire depuis
  les migrations existantes, puis `prisma migrate diff --from-url file:<tmp>
  --to-schema-datamodel prisma/schema.prisma --script`. Une sortie vide = rien à écrire.
- **Exécuteur à nous** (`services/database/migrator.ts`), qui tourne AVANT que Prisma n'ouvre la
  base, par `node:sqlite` (intégré à Node ≥ 22.13, aucune dépendance, présent sous Windows) :
  table `core_migrations (id TEXT PRIMARY KEY, checksum TEXT, appliedAt INTEGER)`, une
  migration = une transaction `BEGIN IMMEDIATE`, contraintes de clés étrangères vérifiées
  (`PRAGMA foreign_key_check`) avant `COMMIT`. Une migration déjà appliquée dont le contenu a
  changé → refus au démarrage (une migration publiée ne se retouche jamais).
- **Il ne touche que ce que ses fichiers nomment** : les migrations sont tirées d'une base qui
  ne contient que le cœur, elles ne peuvent donc nommer ni `seer_*` ni une table d'extension.
  Un test le vérifie sur une base qui porte une table étrangère.
- **Anti-dérive** (`migrationsDrift.test.ts`) : base construite par les migrations, puis
  `prisma migrate diff --from-url … --to-schema-datamodel prisma/schema.prisma --exit-code` = 0.
- `splitSql`, `idempotentDdl`, `runStatements`, `core-init.sql` restent dans le dépôt : ils ne
  servent plus qu'à lire une source MariaDB (tâche 3) et partiront avec elle. `schema-full.sql`
  et `db:schema-sql` disparaissent.

## 4. PRAGMA

| PRAGMA | Valeur | Où |
|---|---|---|
| `journal_mode` | `WAL` | posé par l'exécuteur, persistant dans le fichier |
| `foreign_keys` | `ON` | posé par le moteur sur chaque connexion (mesuré) |
| `busy_timeout` | 15 000 ms | `socket_timeout=15` dans l'URL (mesuré : 5 000 par défaut) |
| `synchronous` | `NORMAL` | après connexion (×30 sur les écritures, mesuré) ; reposé à chaque reconnexion |

`synchronous` vaut pour la connexion : une connexion recyclée revient à `FULL` (mesuré avec
`max_idle_connection_lifetime=2`). Sans ce paramètre, la connexion unique a gardé `NORMAL` après
320 s d'inactivité (mesuré). Le pire cas est donc « plus lent », jamais « moins sûr ».
`NORMAL` en WAL ne peut pas corrompre la base ; une coupure de courant peut perdre les dernières
transactions validées.

Options du client : `transactionOptions: { maxWait: 10 000, timeout: 15 000 }`.

## 5. Reprise : `SQLITE_BUSY` et l'attente du pool

`dbRetry.ts` garde son nom et ses appelants (`deviceRevocation`, `guestAccountCleanup`,
`familyTvEnroll`) ; ce qu'il reconnaît change :

| Code | Cause sur SQLite (mesuré ou relevé) | Rejouer ? |
|---|---|---|
| P1008 | `busy_timeout` dépassé : un autre processus tient le verrou | oui |
| P2028 « Unable to start a transaction » | `maxWait` dépassé dans la file du pool | oui |
| P2024 | attente du pool dépassée (requête ordinaire) | oui |
| P2034, « database is locked », `SQLITE_BUSY` | conflit d'écriture | oui |
| P2002 | unicité ; `meta.target` = TABLEAU des champs (MariaDB : nom d'index) | non |

## 6. Casse et comparaisons

MariaDB (`utf8mb4_unicode_ci`, PAD SPACE) ignore la casse et les espaces finaux ; SQLite non
(mesuré : `findUnique({ key: "abc" })` ne trouve pas `ABC`, ni `"ABC "` ; `ABC` et `abc`
coexistent sous un `@unique`). `mode: "insensitive"` n'existe pas en SQLite (refusé à la
compilation de la requête, mesuré) ; `contains` passe par `LIKE`, insensible à la casse ASCII.

**Décision : normaliser à l'ENTRÉE, pas de `COLLATE NOCASE`.** Prisma ne sait pas déclarer une
collation en SQLite : une collation posée à la main dans une migration serait une dérive
permanente, que `migrate diff` réécrirait. Le recensement et le traitement de chaque cas sont
au § 9.

## 7. Base sur un partage réseau

SQLite en WAL exige une mémoire partagée (`-shm`) et des verrous fiables : NFS, SMB/CIFS et les
FUSE réseau corrompent la base. Au démarrage, le serveur lit le type du système de fichiers du
dossier de données (`/proc/self/mountinfo`, préfixe le plus long ; chemin UNC `\\` sous
Windows) et AVERTIT sans bloquer : journal `[db]` et carte « Base de données » de l'admin
(`storage: "network"`). Types signalés : `nfs`, `nfs4`, `cifs`, `smb3`, `smbfs`, `9p`,
`fuse.sshfs`, `fuse.rclone`, `ceph`, `glusterfs`, `davfs`. Unraid (`fuse.shfs`) n'est PAS
signalé (Jellyfin y vit aussi) : documenté seulement.

## 8. Règles pour les autres tâches

- **API de l'hôte** : `databaseEngine()` (services/db) → `"sqlite"`, à lire au lieu de deviner
  par l'URL ; `getDatabaseFilePath()` pour le chemin.
- **Interface pour la migration (tâche 3)** : `services/database/` expose
  `coreDatabasePath()`, `applyCoreMigrations(path)` (crée ou met à niveau un fichier, sans
  Prisma) et `openSqlite(path, { readOnly })` (`node:sqlite`). La copie écrit dans
  `tentacle.db.migrating`, préparé par `applyCoreMigrations`, puis le renomme.
- **⚠️ Jamais deux bibliothèques SQLite sur le MÊME fichier dans le MÊME processus** :
  mesuré, un `BEGIN IMMEDIATE` tenu par `better-sqlite3` n'a pas bloqué l'écriture de Prisma
  dans le même processus (les verrous POSIX sont par processus) ; dans un processus séparé, elle
  a bien attendu. `node:sqlite` n'ouvre donc `tentacle.db` que Prisma FERMÉ (au démarrage), ou
  depuis un autre processus (CLI). Le fichier `.migrating` n'est ouvert que par la copie.
- **Un seul provider dans le client** : l'image 1.25 ne sait plus SERVIR depuis MariaDB. « En
  cas d'échec, MariaDB reste en service » ne peut donc vouloir dire que : MariaDB reste INTACTE,
  l'image précédente repart dessus, et la 1.25 reste en attente (écran de migration, nouvel
  essai). Servir depuis MariaDB exigerait un deuxième client Prisma dans l'image (`mysql`) :
  décision du coordinateur, hors de ce socle.
- Un modèle ajouté au schéma (ex. `plugin_migrations`) : `pnpm --filter @tentacle-tv/backend
  db:migration <nom>` écrit la migration suivante ; le test anti-dérive échoue tant qu'elle
  manque.
- Toute requête dont l'ordre compte porte un `orderBy` explicite (SQLite rend l'ordre du plan).
- `BigInt` : `$queryRaw` rend un `bigint` pour tout entier calculé → `Number()`.

## 9. Casse : le recensement, cas par cas

Recensement complet du cœur (requêtes Prisma et SQL brut sur une colonne texte dont la valeur
vient de l'extérieur). Un test par cas connu (`caseSensitivity.test.ts`, vraie base).

| Cas | Valeur | Risque | Traitement |
|---|---|---|---|
| Clé d'invitation (`authAccount.ts`, `InviteKey.key`) | générée en hexa minuscule ; saisie à la main, et le miroir mobile tape en MAJUSCULES (`autoCapitalize="characters"`) | **élevé** : MariaDB la trouvait, SQLite non | `trim().toLowerCase()` dans `registerSchema` |
| Jetons de partage (`share.ts`, `ShareLink.token`) | hexa minuscule, dans une URL publique | faible (URL retapée) | `toLowerCase()` sur le paramètre |
| Code de jumelage (`PairingCode.code`) | alphabet majuscule | aucun | déjà `toUpperCase()` à l'entrée |
| Code de provisionnement | jamais cherché depuis une saisie | aucun | rien |
| Identifiants Jellyfin (`jellyfinUserId`, uniques) | `Id` de Jellyfin, 32 hexa minuscules, lu sur Jellyfin | faible | rien : les routes Famille passent déjà par le repli (`sameUserId`) avant d'écrire |
| Identifiants d'éléments en paramètre (préférences, watchlist, segments) | `Id` Jellyfin renvoyé par le client | faible : une ligne en double au pire | rien dans ce chantier |
| Jetons Expo, identifiants d'invitation Famille (base64url) | sensibles à la casse par nature | aucun ; SQLite est CORRECT là où MariaDB repliait | rien |
| `GROUP BY username` de Vigie | noms tels que Jellyfin les rend | faible | session Vigie : grouper par identifiant, pas par nom |

- Noms d'utilisateur, PIN, code d'installation : jamais comparés en base (Jellyfin, haché, fichier).
- Copie depuis MariaDB : ce qui est unique sous `utf8mb4_unicode_ci` l'est aussi en comparaison
  exacte ; la copie ne peut pas violer une unicité.
- Les longueurs `VarChar(n)` ne sont plus tenues par la base (SQLite ne borne pas le TEXT) :
  la validation d'entrée les tient ; aucun code ne lisait l'erreur P2000.
