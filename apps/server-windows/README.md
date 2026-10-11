# Tentacle Server pour Windows — l'hôte

Le `node.exe` officiel, renommé `Tentacle Server.exe` et passé en sous-système
GUI, lance `dist/main.js`. L'hôte fait ce que font le `Dockerfile`, tini et
l'entrypoint de l'image, rien de plus, puis tient l'icône de la zone de
notification. Le serveur lancé est le MÊME `apps/backend/dist/index.js` que
l'image ; le protocole IPC entre les deux est celui du fil A
(`packages/shared/src/serverHost/hostProtocol.ts`).

## Essayer hors paquet

Depuis un dépôt où le backend et le client web sont construits :

```bash
pnpm --filter @tentacle-tv/server-windows build
node apps/server-windows/dist/main.js
```

`--app-root <dossier>` (ou `TENTACLE_APP_ROOT`) fait tourner l'hôte contre un
autre arbre `/app`. Les données vont toujours dans
`%ProgramData%\Tentacle Server` ; « Supprimer les données du serveur… » les
efface.

## Ce que fait l'hôte

| Sujet | Où |
|---|---|
| Une seule instance (tube `\\.\pipe\TentacleServer.host`) ; le second lancement ouvre l'administration | `instance/` |
| Dossier de données `%ProgramData%\Tentacle Server` (`TENTACLE_DATA_DIR`), héritage coupé, SYSTEM + Administrateurs + le compte qui installe ; un autre compte reçoit un message clair | `data/` |
| Environnement en liste blanche (rien d'hérité : ni `DATABASE_URL`, ni `PATH` de l'utilisateur) | `env/serverEnv.ts` |
| Serveur lancé, suivi (`tentacle:ready`, sinon `/api/health`), arrêté par `tentacle:shutdown` puis 10 s de grâce, objet Job `KILL_ON_JOB_CLOSE` ; 75 relance, 0 arrête, une cause de démarrage connue bloque sans boucler | `supervisor/` |
| Port testé avant le lancement ; s'il est pris, notification et sous-menu « Changer de port » | `net/ports.ts`, `host/` |
| Assistant ouvert UNE fois, dans le navigateur par défaut, sur l'adresse locale (jamais `localhost`) | `net/lanAddress.ts`, `host/` |
| Journaux `logs\server-AAAA-MM-JJ.log`, sept jours | `logging/` |
| Démarrer avec Windows : `StartupTask` dans le paquet (`TaskId="TentacleServerStartup"`), clé `Run` hors paquet | `startup/` |
| Icône, menu FR/EN, notifications, fermeture de session | `win32/`, `tray/`, `i18n/` |
| Réseau en profil « Public » signalé une fois | `net/networkProfile.ts` |
| Jellyfin de la machine : registre, `network.xml`, service, processus, puis `/System/Info/Public` (`jellyfin.detect`) | `jellyfin/detect.ts` |
| « Démarrer Jellyfin » : le lanceur de l'installation simple, par l'Explorateur ; un service n'est jamais démarré par nous | `jellyfin/start.ts` |
| Installation guidée : version notée `ok` dans `compat/jellyfin.json`, SHA-256 et taille lus sur l'origine, installateur officiel lancé en interactif, élevé, hors du paquet | `jellyfin/installer/`, `win32/elevatedLaunch.ts` |
| Boîte « Choisir un dossier » de l'Explorateur, dans un processus à part (`--pick-folder`) ; un lecteur mappé est rendu avec son chemin réseau | `dialog/` |
| Les gestes servis au serveur (`HOST_METHODS`, annoncés dans `host-hello`) | `host/hostServices.ts`, `jellyfin/jellyfinHost.ts` |

## Le paquet MSIX

```bash
pnpm --filter @tentacle-tv/server-windows assemble -- --out <dossier> --version X.Y.Z.0 [--tv-client <dossier>]
pnpm --filter @tentacle-tv/server-windows pack:msix -- --dir <dossier> --msix <fichier.msix>
```

- L'icône de la zone de notification est cherchée dans
  `apps/server-windows/assets/tray.ico` (généré depuis `brand/`), sinon celle
  du bureau (dépôt), sinon l'icône générique de Windows.
- Python embarquable dans `<racine>\python\python.exe`, zipapp yt-dlp dans
  `<racine>\tools\yt-dlp` : l'hôte pose `TENTACLE_PYTHON` et
  `TENTACLE_YTDLP_PINNED` dès qu'ils existent.
- La semence des shared-deps : `<racine>\shared-deps-seed`, comme l'image.
- `apps/server-windows/host-options.json` (facultatif) : `{ "jellyfinInstaller": false }`
  coupe l'installation guidée de Jellyfin si le Store la refuse (règle 10.1.5) ;
  l'assistant ne garde alors que « ouvrir jellyfin.org, puis détecter ».
- Le manifeste `compat/jellyfin.json` à la racine, comme l'image : l'hôte y lit
  la version de Jellyfin à installer (ou dans les données, s'il y est plus récent).

- `scripts/assemble.mts` reproduit `/app` de l'image (`layout.test.mts` relit le
  `Dockerfile`), avec le moteur Prisma de Windows, koffi win32-x64 seul,
  `node.exe` 24 vérifié (épingle + `SHASUMS256.txt`) devenu
  `Tentacle Server.exe` en sous-système GUI, Python embarquable et yt-dlp
  épinglés par SHA-256 (`assemble/pins.mts` ; yt-dlp suit le Dockerfile).
  Identité en paramètres (`--identity-name`, `--publisher`,
  `--publisher-display-name`) ; celle de développement par défaut.
- `msix/Package.appxmanifest` : le modèle. Un exe empaqueté démarre dans
  System32 : l'hôte est retrouvé depuis `process.execPath` (`-e`), d'où
  `uap10:Parameters` et MinVersion 19041.
- Icônes : `brand/generate-icons.py --write server-windows` (tuiles et
  `assets/tray.ico`), jamais retouchées à la main.
- Essai : en VM seulement, `msix/vm/README.md`.

## La commande `tentacle`

L'alias d'exécution `tentacle.exe` lance le même exe avec `--cli` : l'hôte
lance `cli/tentacle.js` avec l'environnement du serveur (`cli/`). L'exe étant
GUI, il s'attache à la console du shell et y recopie la sortie
(`win32/console.ts`) ; sortie redirigée : héritée telle quelle ; sans console :
boîte de message.

## La mise à jour par le Store

`update/` : vérification quotidienne (StoreContext par koffi), téléchargement
silencieux si Windows le permet, moment calme demandé au serveur (`status`),
arrêt propre, sauvegarde `backups\tentacle-<version>.db` (trois gardées),
`RegisterApplicationRestart`, installation. Sans voie silencieuse :
« Installer la mise à jour » dans le menu.
