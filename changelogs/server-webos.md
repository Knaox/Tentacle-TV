# Changelog — Serveur reconstruit pour le client LG webOS

L'image Docker du serveur sert aussi, sous `/tv`, le client des téléviseurs LG.
Ce client n'est livré QUE par `.github/workflows/webos.yml` : une livraison webOS
reconstruit l'image du serveur avec le nouveau client, sans rien changer au
serveur lui-même — c'est l'image publiée de `versions.json` → `server`, reprise
à l'octet près. `server.yml`, de son côté, reprend le client de l'image en
service et ne le change jamais.

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`, où **X.Y.Z est la version webOS**
(`versions.json` → `webos`), la même que celle du bloc de `changelogs/webos.md`.
Au cran store, la Release GitHub `server-v<serveur>-webos-X.Y.Z` porte ce bloc :
il dit, à ceux qui tirent l'image Docker, ce qui change pour les téléviseurs LG.
Exigé par le pré-vol de `webos.yml` au cran store, avant le moindre build.

Ces blocs vivent à part de `changelogs/server.md` exprès : un bloc « [1.1.0] »
y désignerait le VIEUX serveur 1.1.0, et le pré-vol comme la Release le
prendraient pour les notes de cette reconstruction.

## [1.1.0]
### FR
- **L'interface des téléviseurs LG se livre désormais à part** : servie sous `/tv` par ce serveur, elle n'est plus reconstruite à chaque mise à jour du serveur, seulement par une livraison de l'application LG comme celle-ci
- **Le serveur ne change pas** : même moteur, même client web, aucune migration de la base — seule l'interface servie aux téléviseurs LG est remplacée
- **Téléviseurs LG** : Réglages › À propos annonce la version 1.1.0, celle de l'application (nouvelle icône, nouvel écran de lancement et installateur sans prérequis : voir les notes webOS 1.1.0)
- Pour la recevoir, il suffit de tirer l'image (`docker compose pull && docker compose up -d`) ; un téléviseur resté allumé se recharge de lui-même en ouvrant son prochain écran

### EN
- **The LG TV interface now ships on its own**: served under `/tv` by this server, it is no longer rebuilt with every server update, only by an LG app release like this one
- **The server does not change**: same engine, same web client, no database migration — only the interface served to LG TVs is replaced
- **LG TVs**: Settings › About shows version 1.1.0, the app's version (new icon, new launch screen and an installer with no prerequisites: see the webOS 1.1.0 notes)
- To get it, just pull the image (`docker compose pull && docker compose up -d`); a TV left on reloads by itself when it opens its next screen
