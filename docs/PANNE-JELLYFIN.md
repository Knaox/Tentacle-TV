# Panne de Jellyfin pendant une lecture

Passation du 2026-10-05 (Baby Reindeer S01E03 sur le bureau 1.26.0). Ce qui
est en place, ce qui a été MESURÉ, et les deux bancs qui le rejouent.

## Le principe

Le backend surveille Jellyfin (`apps/backend/src/services/jellyfinHealth*.ts`)
et dit son état à chaque lecteur par le canal de session :
`{ type: "server:jellyfin", state, since }`, à chaque changement et après
chaque `session:ready` (même `up`). Additif : un client plus ancien l'ignore,
pas de `minServer` à monter. Aussi dans `/api/health` et `/api/admin/services`.

Les lecteurs appliquent UNE règle (`packages/api-client/src/playback/`) :
`outageView` (bandeau, écran d'arrêt au bout de 3 min, 15 s de reprise
muette) et `useOutageGate` (erreurs tues pendant la panne, flux TOUJOURS
rouvert au retour — même position, mêmes pistes, nouvelle session). Les
phrases : `jellyfinOutageCopy` (shared). Web et bureau : `useWebPlaybackProblem`
+ `JellyfinOutageNotice` ; mobile : `usePlayerProblem` + `JellyfinOutageBanner` ;
Apple TV et Android TV : l'état vaut une sonde qui fait foi dans leur reprise
(tv-core `serverOutage.ts`, `useServerJellyfinHealth`). webOS : hors périmètre.

## Mesuré sur Jellyfin 10.11.11 (conteneur officiel)

| Geste | Ce que dit la socket | Puis |
|---|---|---|
| `POST /System/Restart` | `ServerRestarting` (100 ms), fermeture 1000 | 0,7 s fermé, 503 « loading » 6,6 s |
| `docker restart` | `ServerShuttingDown` — jamais `Restarting` | 1,3 s fermé, **un 200 transitoire**, 503 ~5 s |
| `docker stop` | `ServerShuttingDown` | port fermé jusqu'au `docker start` |
| `docker kill` | rien, fermeture 1006 | port fermé |

- Les annonces partent sur TOUTES les sockets, celle de la clé d'API comprise.
- Le **200 transitoire** du démarrage vient du serveur d'attente de 10.11 :
  camelCase, sans `Id`. Le vrai serveur répond en PascalCase avec son `Id`.
  Toute sonde « Jellyfin est revenu » exige l'`Id` (backend et TV).
- Jellyfin **valide le `PlayMethod`** à chaque report : « Transcode » sans
  encodage vivant pour ce PlaySessionId est enregistré « DirectPlay ».
- `TranscodingInfo` **clignote** pendant un vrai transcodage
  (`TTTTTTTTT·T·T···` relevé toutes les 500 ms) et disparaît quand ffmpeg a
  fini ; après la mort d'un encodage, `PlayMethod=Transcode` et le
  `TranscodingInfo` périmé restent jusqu'au report suivant (≥ 20 s relevées).
  D'où la mémoire des encodages du tableau de bord (`transcodeMemory.ts`) et
  le report immédiat d'un changement de méthode (`playbackReporter.ts`).
- Une URL de transcodage construite par le client sans `TranscodeReasons`
  arrive « sans raison ». Avec `ContainerBitrateExceedsLimit`, Jellyfin
  l'enregistre et le tableau de bord dit « débit plafonné ».

## Les bancs (depuis `apps/backend`, Docker requis)

```bash
pnpm bench:jellyfin-outage       # vrai backend + faux Jellyfin + faux lecteurs : 57 vérifications
pnpm bench:jellyfin-outage:web   # la vraie app web dans Chrome sans tête : 48 vérifications
```

Le faux Jellyfin (`test/jellyfin-outage/fakeJellyfin.ts`) rejoue les séquences
du tableau ci-dessus ; le banc web sert un vrai film (fichier direct à débit
bridé, HLS à deux pistes audio) et mesure depuis la page. Résultats du
2026-10-05 : annonce reçue en 2 ms, retour dit 0,06 à 0,7 s après le vrai
retour, bandeau du lecteur en 10 à 200 ms, aucune erreur, reprise 2 à 3,4 s
après le retour à la position exacte, nouvelle session, même piste audio.

Ce que les bancs ne jouent pas : mpv (bureau), le mobile et les téléviseurs
sur appareil — leur logique passe par les mêmes règles, testées unitairement.
