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

## Passer d'un ancien fichier compose

Depuis la 1.25, le dépôt livre **deux** piles, `tentacle-full` et `tentacle-only`, sans base de données.
`stacks/tentacle-db`, le `docker-compose.yml` et le `docker-compose.external.yml` de la racine n'y sont plus.
**Votre copie continue de marcher** avec la nouvelle image : sa MariaDB (ou la base choisie dans l'ancien
assistant) est migrée vers SQLite d'elle-même au premier démarrage de la 1.25
([sqlite-migration.md](sqlite-migration.md)), et l'image rend à son propriétaire un ancien volume de données au
démarrage (elle tourne ensuite sous `PUID:PGID`).

Pour passer à une pile d'aujourd'hui, **après** que le tableau de bord a dit « MariaDB n'est plus
nécessaire » :

1. Dans le **même dossier**, mettez `tentacle-full` (avec Jellyfin) ou `tentacle-only` (Tentacle seul) à la place
   de votre fichier (`curl -fsSLo compose.yaml …`, voir [install.md](install.md)) ; supprimez un ancien
   `docker-compose.yml` resté à côté. Reportez vos propres modifications (ports, GPU, `TENTACLE_WEB_UI`…) ;
   votre `.env` reste valable.
2. `docker compose up -d --remove-orphans` : les anciens conteneurs `db`, `init` (ou `web`) sont retirés. Le
   volume de données garde son nom (`<dossier>_tentacle-data`) : Tentacle redémarre sur sa `tentacle.db`,
   assistant fermé.
3. Plus tard, seulement quand vous êtes sûr : `docker volume rm` l'ancien volume de la base
   (`<dossier>_tentacle-db`, ou `<dossier>_tentacle-db-data` pour l'ancien `docker-compose.yml` de la racine) et
   `<dossier>_tentacle-secrets`.

La carte « MariaDB n'est plus nécessaire » du tableau de bord donne ces étapes pour l'installation qu'elle
détecte.
