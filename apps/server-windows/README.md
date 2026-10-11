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

## Pour le paquet MSIX (fil D)

- `TaskId` de la `windows.startupTask` : `TentacleServerStartup`.
- L'icône de la zone de notification est cherchée dans
  `apps/server-windows/assets/tray.ico` (à générer depuis `brand/`), sinon celle
  du bureau (dépôt), sinon l'icône générique de Windows.
- Python embarquable dans `<racine>\python\python.exe`, zipapp yt-dlp dans
  `<racine>\tools\yt-dlp` : l'hôte pose `TENTACLE_PYTHON` et
  `TENTACLE_YTDLP_PINNED` dès qu'ils existent.
- La semence des shared-deps : `<racine>\shared-deps-seed`, comme l'image.

## Pas encore là

- La commande `tentacle` (alias d'exécution) : un exe en sous-système GUI n'a
  pas de console où écrire ; à trancher avec le fil D (second exe console, ou
  `AttachConsole`).
- La mise à jour par le Store (fil D) : `ServerProcess.request("status")` et
  `stop("update")` sont prêts.
