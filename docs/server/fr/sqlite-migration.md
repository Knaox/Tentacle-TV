# Migration vers SQLite (serveur 1.25)

*English version: [../sqlite-migration.md](../sqlite-migration.md).*

Depuis la 1.25, Tentacle garde toutes ses données dans **un fichier**, `data/tentacle.db` (SQLite), de son
volume de données. Plus de serveur de base de données : un conteneur de moins, 100 à 200 Mo de mémoire
gagnés, et une sauvegarde, c'est copier un fichier. Les installations qui utilisaient **MariaDB** (ou MySQL)
sont migrées **d'elles-mêmes**.

## Ce que vous faites : rien

Mettez à jour l'image comme d'habitude (`docker compose pull && docker compose up -d`, *Pull and redeploy* de
Portainer, le bouton de mise à jour de votre NAS). **Gardez votre fichier compose tel quel** — son service
`db`, ses variables `DB_*` ou `DATABASE_URL`, ou la base choisie dans l'ancien assistant
(`data/database.json`) : c'est ainsi que Tentacle retrouve vos données. Ne les retirez que quand le tableau de
bord le dit (voir plus bas).

## Ce qui se passe

1. À son premier démarrage, Tentacle voit une MariaDB configurée et pas de `tentacle.db` : il migre.
   **MariaDB n'est que lue** — dans une transaction en lecture seule, sur un instantané cohérent. Elle n'est
   jamais modifiée, pas même si la migration échoue.
2. Pendant ce temps, le web, les applications de bureau et mobiles, les téléviseurs affichent **« Migration de
   la base de données en cours »**, avec l'avancement et le temps restant estimé. Cela prend d'ordinaire
   quelques secondes ; sur un NAS lent, une minute ou deux. Les applications pas encore à jour voient
   seulement le serveur redémarrer pendant ces secondes.
3. Avant la bascule, tout est **vérifié** : les lignes de chaque table, une somme de contrôle par colonne, et
   un échantillon relu comme le serveur le lira. La nouvelle base n'est mise en place qu'ensuite.
4. Tentacle démarre sur SQLite. Son cache des fiches TMDB suit **en fond**, copié depuis MariaDB (aucun appel
   à TMDB) ; la carte *Services › Base de données* en montre l'avancement. Les recommandations l'attendent.
5. Le tableau de bord dit alors **« MariaDB n'est plus nécessaire »**, avec la marche à suivre pour votre
   installation.

| Mesuré (vraie base : 50 tables, 114 000 lignes, 800 Mo dont 92 % de cache) | Machine rapide | NAS lent (simulé) |
|---|---|---|
| Interruption (tout sauf le cache TMDB, vérifications comprises) | ~3 s | ~1 min au plus |
| Cache TMDB, en fond, serveur déjà en service | ~4 s | ~2,5 min |

## Retirer MariaDB

⚠️ **Seulement quand le tableau de bord dit « MariaDB n'est plus nécessaire ».** Avant, vos données peuvent
n'être encore que dans MariaDB.

Le tableau de bord donne la marche à suivre pour l'installation qu'il détecte (sans jamais parler à Docker),
les autres à côté :

- **Pile officielle d'avant la 1.25** (`tentacle-full` ou `tentacle-db`, avec leur service `db`), deux voies :
  - la plus simple : dans le même dossier, remplacez `compose.yaml` par la
    [`tentacle-full`](../../../stacks/tentacle-full/compose.yaml) d'aujourd'hui (elle remplace `tentacle-full`) ou
    par [`tentacle-only`](../../../stacks/tentacle-only/compose.yaml) (elle remplace `tentacle-db`) ; reportez vos
    propres modifications (ports, GPU…), votre `.env` reste valable ;
  - ou retirez les lignes vous-même : les services `db` et `init`, `db` dans le `depends_on` de `tentacle`,
    `DB_HOST` et `DB_PASSWORD_FILE`, le montage `tentacle-secrets`, et les volumes `tentacle-db` et
    `tentacle-secrets` en bas du fichier.

  Puis `docker compose up -d --remove-orphans` : les conteneurs `db` et `init` sont arrêtés et retirés ; les
  données restent dans leur volume. Plus tard, **seulement quand vous êtes sûr**, `docker volume rm
  <projet>_tentacle-db <projet>_tentacle-secrets` les supprime pour de bon (`docker volume ls` donne les noms ;
  `<projet>` est d'ordinaire le nom du dossier). Un `depends_on` oublié fait refuser le démarrage par Compose,
  avec `service "tentacle" depends on undefined service "db": invalid compose project` : retirez-le.
- **Docker Compose** : retirez le service `db`, son entrée dans `depends_on` et, dans le service Tentacle, les
  variables `DB_*` / `DATABASE_URL`, puis `docker compose up -d --remove-orphans`.
- **Portainer** : *Stacks* → votre pile → *Editor* : collez la nouvelle pile, ou retirez le service `db` et les
  variables ; *Update the stack* en cochant **Prune services** (sans lui, le conteneur de la base continue de
  tourner). Une pile reliée au dépôt : remettez sa référence sur `refs/heads/main`, *Pull and redeploy*. Plus
  tard : *Volumes* → le volume de la base → *Remove*.
- **Synology** (Container Manager), **Unraid**, **CasaOS** : la même chose, dans leur interface.
- **Base choisie dans l'ancien assistant** (`tentacle-only` d'avant la 1.25, et les installations sans
  variables `DB_*`) : elle est désignée par un fichier du dossier de données ; le tableau de bord donne la
  commande qui le supprime, à lancer dans la console du conteneur, puis redémarrez Tentacle.
- **Base externe** (une MariaDB sur une autre machine, un NAS) : retirez les variables (ou ce fichier),
  redémarrez Tentacle ; puis, quand vous le souhaitez, supprimez la base Tentacle de ce serveur avec la commande
  `DROP DATABASE` que donne le tableau de bord — Tentacle n'exécute jamais rien sur l'ancienne base.

## Si la migration n'aboutit pas

L'écran dit **« La migration n'a pas abouti. Vos données sont intactes. »**, avec la raison en mots simples —
jamais un détail technique à un visiteur anonyme. L'ancienne base n'est pas modifiée ; rien n'est basculé.

- Tentacle **réessaie seul** (après 30 s, 1, 2, 5, 10, puis toutes les 15 minutes) et à chaque redémarrage.
- **Réessayer tout de suite**, avec un rapport lisible : `tentacle db migrate` dans la console du conteneur
  (Portainer : *Console* ; ou `docker exec <conteneur> tentacle db migrate`).
- Les lignes **`[db-migration]`** du journal disent quoi exactement (des noms de tables et des comptes, jamais
  vos données).

| Raison à l'écran | Que faire |
|---|---|
| L'ancienne base ne répond pas | MariaDB est-elle démarrée, joignable par Tentacle, avec le même mot de passe ? |
| Un réglage de connexion n'est pas compris | Un paramètre inconnu de `DATABASE_URL` : le journal le nomme. Un TLS demandé (`sslaccept`, `sslcert`…) est toujours exigé, jamais abandonné. |
| Trop ancienne pour passer directement à cette version | Un serveur d'avant la 1.4.0 : installez la 1.24, démarrez-la une fois, puis la 1.25. |
| Pas assez de place | Libérez de la place dans le dossier de données (environ la taille de l'ancienne base + 10 %). |

## Revenir en arrière

L'image précédente (par exemple `ghcr.io/knaox/tentacle-tv:v1.24.0`) **repart toujours sur votre MariaDB**,
intacte. Si vous remettez ensuite la 1.25 après que l'ancienne image a écrit dans MariaDB, Tentacle **le
détecte** et le dit dans « À régler » : *« L'ancienne base MariaDB a changé depuis la migration »*. Rien n'est
fait automatiquement. La carte *Base de données* propose **Migrer à nouveau** : le serveur redémarre et migre
depuis MariaDB ; la base SQLite actuelle est gardée en copie de secours (`tentacle.db.<date>.bak`), et tout ce
qui a été écrit depuis la première migration est remplacé par l'état de MariaDB.

## MariaDB retirée trop tôt

Une pile passée au nouveau compose avant la migration (plus de service `db`, plus de variables `DB_*`) ne peut
pas être migrée : plutôt que de démarrer sur une base vide, Tentacle reste sur l'écran d'attente et dit
*« Cette installation utilisait une base MariaDB qui n'est plus configurée »*. Il reconnaît une telle
installation à ce qu'elle a laissé dans son dossier de données, même sans être jamais passée par la 1.24.
Remettez le service de la base et ses variables, redémarrez, laissez la migration se faire, puis retirez-les.

- **Pile Portainer déployée depuis ce dépôt** (*Repository*) : elle reçoit la nouvelle `tentacle-full` dès sa
  publication, avant d'avoir migré. Mettez sa référence sur l'étiquette **`refs/tags/server-v1.24.0`** et
  redéployez : l'ancienne pile revient, sa MariaDB avec elle, et l'image actuelle migre. Quand le tableau de
  bord dit « MariaDB n'est plus nécessaire », remettez la référence sur `refs/heads/main` et redéployez.
- **À la main** : les anciens fichiers restent sous cette étiquette —
  [`tentacle-full`](https://github.com/Knaox/Tentacle-TV/blob/server-v1.24.0/stacks/tentacle-full/compose.yaml),
  [`tentacle-db`](https://github.com/Knaox/Tentacle-TV/blob/server-v1.24.0/stacks/tentacle-db/compose.yaml).
  Remettez le vôtre dans le même dossier le temps de la migration, puis revenez au nouveau.

Cette base est perdue pour de bon, ou vous voulez vraiment repartir de zéro ? Dans la console du conteneur :
`tentacle db start-fresh --confirm`, puis redémarrez. Une installation neuve démarre (l'assistant s'ouvre) ;
l'ancienne base n'est pas touchée.

## Bon à savoir

- **Votre propre MariaDB ou MySQL** (tentacle-only, NAS) : la même URL qu'avant est lue de la même façon
  (port, caractères encodés, mot de passe par fichier, paramètres TLS). Un compte qui n'a que le droit
  `SELECT` suffit.
- **Une base partagée avec d'autres applications** : leurs tables sont recopiées aussi, par précaution, et
  listées au rapport comme « tables non reconnues, copiées par précaution ». Rien ne se perd.
- **Les extensions** (Vigie…) : leurs tables sont recopiées entières. Une extension qui ne sait pas encore
  SQLite reste arrêtée, avec un message clair, jusqu'à sa mise à jour.
- **Les fuseaux horaires** : les dates écrites par MariaDB dans son propre fuseau sont converties en UTC.
- **Partages réseau** : gardez le dossier de données sur un disque local ; sur NFS ou SMB, SQLite peut s'abîmer.
- **Une base sur une AUTRE machine, sans TLS** : pendant la copie, ses données traversent le réseau en clair.
  Ajoutez `sslaccept=strict` à son adresse (avec `sslcert` au besoin), ou faites tourner Tentacle sur la même
  machine que la base le temps de la migration. TLS demandé, la connexion est toujours chiffrée, jamais en
  clair à sa place.

## Vérifier que vos données sont sur SQLite

- *Administration › Services › Base de données* : moteur **SQLite**, fichier `data/tentacle.db`, *« Migrée
  depuis MariaDB le … »* avec le nombre de tables et de lignes.
- Dans la console du conteneur : `tentacle db migrate` affiche le rapport de migration, et
  `tentacle db query "SELECT COUNT(*) AS n FROM paired_devices"` lit la base (en lecture seule).
- Vos comptes, appareils, notes, historique et réglages y sont ; vos TV et applications restent connectées.
