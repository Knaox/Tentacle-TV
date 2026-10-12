# Changelog — Tentacle Server pour Windows

L'application du Microsoft Store qui installe et fait tourner le serveur
Tentacle sur un PC Windows, sans Docker. Lu par
`.github/workflows/server-windows.yml` pour les « Nouveautés » de la fiche
(limite du Microsoft Store : 1 500 caractères PAR LANGUE, coupés à la puce au
delà — le pré-vol dit de combien).

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`, où **X.Y.Z est la version du
SERVEUR** (`versions.json` → `server`) : depuis le 2026-10-12, la version de
l'app EST celle du serveur qu'elle embarque (paquet `X.Y.Z.0`). Seule
exception, la 1.0.0 ci-dessous, construite à la main hors workflow ; la suivante
sera celle du premier serveur livré avec l'app (1.27.0 ou au-delà). Le bloc dit
ce qui change POUR L'APP WINDOWS (l'hôte, l'icône, et ce que le serveur apporte
à ses utilisateurs) : un bloc de `changelogs/server.md` ne vaut pas ici, il
faut les DEUX quand `server.yml` enchaîne l'app (entrée `windows`). Exigé par le
pré-vol de `server-windows.yml` — et par celui de `server.yml` quand il
l'enchaîne — aux crans test et store, avant le moindre build.

## [1.0.0]
### FR
- **Tentacle Server arrive sur Windows** : le serveur Tentacle s'installe depuis le Microsoft Store, sans Docker ni ligne de commande
- **Une icône dans la zone de notification** pour ouvrir l'administration, lire le journal, redémarrer ou quitter le serveur
- **Démarre avec Windows**, à l'ouverture de session — une case du menu, que les Paramètres de Windows gardent sous votre contrôle
- **Un écran de démarrage dès le lancement** : l'étape en cours, puis l'assistant — et une seule question, lancer Tentacle Server avec Windows
- **L'assistant d'installation s'ouvre au premier lancement** : il trouve Jellyfin sur ce PC, l'installe et le démarre au besoin, et vous guide jusqu'à vos bibliothèques
- **Vos données sont gardées** dans `C:\ProgramData\Tentacle Server` : une désinstallation ne les efface pas, et une réinstallation reprend le serveur tel quel
- Nécessite Jellyfin, serveur multimédia gratuit, installé sur ce PC ou sur une autre machine du réseau

### EN
- **Tentacle Server comes to Windows**: install the Tentacle server from the Microsoft Store, no Docker and no command line
- **A notification area icon** to open the dashboard, read the log, restart or quit the server
- **Starts with Windows**, at sign-in — one menu checkbox, kept under your control in Windows Settings
- **A startup screen as soon as it launches**: the current step, then the wizard — and a single question, start Tentacle Server with Windows
- **The setup wizard opens on first launch**: it finds Jellyfin on this PC, installs and starts it if needed, and walks you to your libraries
- **Your data is kept** in `C:\ProgramData\Tentacle Server`: uninstalling does not erase it, and reinstalling picks the server up as it was
- Requires Jellyfin, the free media server, installed on this PC or on another machine on your network
