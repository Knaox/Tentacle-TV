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
| `tentacle-db` | la base de Tentacle (réglages, données des comptes, statistiques) |
| `tentacle-data` | le dossier de données de Tentacle (extensions, caches) |
| `tentacle-secrets` | les mots de passe générés de la base |
| `jellyfin-config` | *full* : la configuration de Jellyfin |

Une copie de la base :

```bash
docker compose exec db sh -c 'mariadb-dump -u tentacle -p"$(cat /run/tentacle-secrets/db_password)" tentacle' > tentacle.sql
```

## Migrer depuis l'ancien `docker-compose.yml`

L'ancien `docker-compose.yml` du dépôt (et `docker-compose.external.yml`) **continue de marcher** avec la
nouvelle image : `DATABASE_URL` est toujours lu, et l'image rend à son propriétaire un ancien volume de données
au démarrage (elle tourne ensuite sous `PUID:PGID`). Rien ne vous oblige à bouger.

Pour passer quand même à une pile neuve (secrets générés, contrôles de santé, Jellyfin et mandataire HTTPS en
option) :

1. Copiez l'ancienne base :
   `docker compose exec db mariadb-dump -u root -p"$MYSQL_ROOT_PASSWORD" tentacle_db > tentacle.sql`
2. Arrêtez l'ancienne pile (`docker compose down`, **sans** `-v`), et gardez son dossier.
3. Dans un nouveau dossier, démarrez une fois **tentacle-db** (ou *tentacle-full*) : `docker compose up -d`.
4. Importez la copie :
   `docker compose exec -T db sh -c 'mariadb -u tentacle -p"$(cat /run/tentacle-secrets/db_password)" tentacle' < tentacle.sql`
5. Recopiez le contenu de l'ancien volume de données (`tentacle-data`) dans le nouveau, puis
   `docker compose restart tentacle`.

Le serveur trouve une base installée et garde son assistant fermé.
