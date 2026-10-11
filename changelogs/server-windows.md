# Changelog — Tentacle Server pour Windows

L'application du Microsoft Store qui installe et fait tourner le serveur
Tentacle sur un PC Windows, sans Docker. Lu par
`.github/workflows/server-windows.yml` pour les « Nouveautés » de la fiche
(limite du Microsoft Store : 1 500 caractères PAR LANGUE, coupés à la puce au
delà — le pré-vol dit de combien).

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`, où **X.Y.Z est la version de
l'app** (`versions.json` → `serverWindows`), jamais celle du serveur qu'elle
embarque (`versions.json` → `server`) : les deux avancent chacune à son pas.
Un bloc de `changelogs/server.md` ne vaut donc pas ici. Exigé par le pré-vol de
`server-windows.yml` aux crans test et store, avant le moindre build.

## [1.0.0]
### FR
- **Tentacle Server arrive sur Windows** : le serveur Tentacle s'installe depuis le Microsoft Store, sans Docker ni ligne de commande
- **Une icône dans la zone de notification** pour ouvrir l'administration, lire le journal, redémarrer ou quitter le serveur
- **Démarre avec Windows**, à l'ouverture de session — une case du menu, que les Paramètres de Windows gardent sous votre contrôle
- **L'assistant d'installation s'ouvre au premier lancement** : il trouve Jellyfin sur ce PC et vous guide jusqu'à vos bibliothèques
- **Vos données sont gardées** dans `C:\ProgramData\Tentacle Server` : une désinstallation ne les efface pas, et une réinstallation reprend le serveur tel quel
- Nécessite Jellyfin, serveur multimédia gratuit, installé sur ce PC ou sur une autre machine du réseau

### EN
- **Tentacle Server comes to Windows**: install the Tentacle server from the Microsoft Store, no Docker and no command line
- **A notification area icon** to open the dashboard, read the log, restart or quit the server
- **Starts with Windows**, at sign-in — one menu checkbox, kept under your control in Windows Settings
- **The setup wizard opens on first launch**: it finds Jellyfin on this PC and walks you to your libraries
- **Your data is kept** in `C:\ProgramData\Tentacle Server`: uninstalling does not erase it, and reinstalling picks the server up as it was
- Requires Jellyfin, the free media server, installed on this PC or on another machine on your network
