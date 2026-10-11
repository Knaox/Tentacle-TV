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
| Journaux `logs\server-AAAA-MM-JJ.log`, sept jours | `logs/` |
| Démarrer avec Windows : `StartupTask` dans le paquet (`TaskId="TentacleServerStartup"`), clé `Run` hors paquet | `startup/` |
| Icône, menu FR/EN, notifications, fermeture de session | `win32/`, `tray/`, `i18n/` |
| Réseau en profil « Public » signalé une fois | `net/networkProfile.ts` |
| Jellyfin de la machine : registre, `network.xml`, service, processus, puis `/System/Info/Public` (`jellyfin.detect`) | `jellyfin/detect.ts` |
| « Démarrer Jellyfin » : le lanceur de l'installation simple, par l'Explorateur ; un service n'est jamais démarré par nous | `jellyfin/start.ts` |
| Installation guidée : version notée `ok` dans `compat/jellyfin.json`, SHA-256 et taille lus sur l'origine, installateur officiel lancé en interactif, élevé, hors du paquet | `jellyfin/installer/`, `win32/elevatedLaunch.ts` |
| Boîte « Choisir un dossier » de l'Explorateur, dans un processus à part (`--pick-folder`) ; un lecteur mappé est rendu avec son chemin réseau | `dialog/` |
| Les gestes servis au serveur (`HOST_METHODS`, annoncés dans `host-hello`) | `host/hostServices.ts`, `jellyfin/jellyfinHost.ts` |

## Pour le paquet MSIX (fil D)

- `TaskId` de la `windows.startupTask` : `TentacleServerStartup`.
- L'icône de la zone de notification est cherchée dans
  `apps/server-windows/assets/tray.ico` (à générer depuis `brand/`), sinon celle
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

## Pas encore là

- La commande `tentacle` (alias d'exécution) : un exe en sous-système GUI n'a
  pas de console où écrire ; à trancher avec le fil D (second exe console, ou
  `AttachConsole`).
- La mise à jour par le Store (fil D) : `ServerProcess.request("status")` et
  `stop("update")` sont prêts.
