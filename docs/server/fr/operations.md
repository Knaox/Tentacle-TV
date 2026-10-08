# Exploitation

*English version: [../operations.md](../operations.md).*

## Mettre à jour

```bash
docker compose pull
docker compose up -d
```

`TENTACLE_VERSION=latest` (le défaut) suit chaque version ; figez une version dans `.env` pour ne mettre à
jour que quand vous le décidez. La vue d'ensemble de l'administration montre la version en service, la
dernière publiée et la commande à copier — Tentacle ne pilote jamais Docker lui-même.

**La mise à jour vers la 1.25 depuis une version d'avant** fait passer la base de MariaDB à SQLite, d'elle-même :
un écran d'attente s'affiche pendant ce temps, puis le tableau de bord dit comment retirer MariaDB —
[sqlite-migration.md](sqlite-migration.md).

## Journaux

```bash
docker compose logs -f tentacle     # Compose, depuis le dossier de la pile
docker logs -f <conteneur>          # tout conteneur Docker/Podman, par son nom ou son identifiant
```

Dans Portainer : *Containers* → le conteneur Tentacle → **Logs** ; sur un NAS, la page du journal du
conteneur. Jetons, mots de passe et clés d'API y sont masqués.

## Rouvrir l'assistant d'installation

L'installation faite, l'assistant est fermé pour de bon. Seule la machine peut le rouvrir : tapez
`tentacle setup reset` dans la console du conteneur (Portainer : **Console** → *Connect*), redémarrez le
conteneur, et lisez le nouveau code dans son journal. Depuis un terminal :

```bash
docker exec <conteneur> tentacle setup reset
docker restart <conteneur>
docker logs <conteneur>             # le nouveau code d'installation
```

Vos réglages, le lien avec Jellyfin et les bibliothèques restent ; l'assistant reprend aux bibliothèques et
redemande le compte administrateur à la fin.

Un nouveau code tant que l'installation est encore ouverte : `tentacle setup token` dans la console du conteneur (`docker exec <conteneur> tentacle setup token`).

## La clé d'API de Jellyfin

Tentacle crée sa propre clé (« Tentacle ») pendant l'installation. Pour la remplacer : **Jellyfin › Tableau de
bord › Clés API**, créez une clé, puis collez-la dans **Administration › Services › Jellyfin**. Tentacle ne
remontre jamais la clé.

## Sauvegarder

Les volumes portent tout :

| Volume | Contenu |
|---|---|
| `tentacle-data` | le dossier de données de Tentacle : **sa base `tentacle.db`** (réglages, données des comptes, statistiques, données des extensions), extensions, caches |
| `jellyfin-config` | *full* : la configuration de Jellyfin |
| `tentacle-db`, `tentacle-secrets` | avant la 1.25 : l'ancienne base MariaDB et ses mots de passe. À garder jusqu'à ce que le tableau de bord dise « MariaDB n'est plus nécessaire » ([sqlite-migration.md](sqlite-migration.md)) |

La base est un fichier. Pour une copie cohérente, arrêtez Tentacle un instant (SQLite écrit en mode WAL :
copiez ensemble `tentacle.db` et, s'il existe, `tentacle.db-wal`) :

```bash
docker compose stop tentacle
docker compose cp tentacle:/app/apps/backend/data/tentacle.db ./tentacle-sauvegarde.db
docker compose start tentacle
```

Pour la remettre : arrêtez Tentacle, reposez le fichier en `data/tentacle.db` (et retirez `tentacle.db-wal` /
`-shm`), redémarrez. Le fichier porte les secrets du serveur (secret JWT, clés Jellyfin et TMDB) : gardez la
copie à l'abri.

## Migrer depuis l'ancien `docker-compose.yml`

L'ancien `docker-compose.yml` du dépôt (et `docker-compose.external.yml`) **continue de marcher** avec la
nouvelle image : sa MariaDB est migrée vers SQLite d'elle-même au premier démarrage de la 1.25
([sqlite-migration.md](sqlite-migration.md)), et l'image rend à son propriétaire un ancien volume de données au
démarrage (elle tourne ensuite sous `PUID:PGID`). Rien ne vous oblige à bouger.

Pour passer quand même à une pile neuve, **après** que le tableau de bord a dit « MariaDB n'est plus
nécessaire » :

1. Arrêtez l'ancienne pile (`docker compose down`, **sans** `-v`), et gardez son dossier.
2. Dans un nouveau dossier, prenez **tentacle-full** ou **tentacle-only**, et démarrez-la une fois :
   `docker compose up -d`.
3. Arrêtez-la, recopiez le contenu de l'ancien volume de données (`tentacle-data`, qui porte maintenant
   `tentacle.db`) dans le nouveau, puis `docker compose up -d`.

Le serveur trouve sa base installée et garde son assistant fermé.
