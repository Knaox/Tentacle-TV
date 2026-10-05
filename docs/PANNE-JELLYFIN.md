# Panne de Jellyfin pendant une lecture

Passation du 2026-10-05 (Baby Reindeer S01E03 sur le bureau 1.26.0). Ce qui
est en place, et ce qui a été MESURÉ.

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

## Mesuré pendant le chantier

Avec un faux Jellyfin qui rejouait ces séquences, le vrai backend et la vraie
app web dans Chrome (outillage retiré ensuite, au profit d'essais manuels ;
il vit dans l'historique de la branche, commit « test(serveur) : le banc des
pannes… ») :

| Mesure | Résultat |
|---|---|
| Annonce de Jellyfin → lecteurs | 1 ms |
| `docker stop` / `kill` → « arrêté » dit | 2,0 s / 3,0 s |
| Vrai retour → « up » dit (le 200 transitoire ignoré) | 10 à 724 ms |
| Retour → lectures redites et nouvelle session chez Jellyfin | 20 à 734 ms |
| Bandeau du lecteur web | 39 à 152 ms |
| Retour → lecture repartie, position exacte (image calée 2,4 à 21,3 s) | 2,3 à 3,4 s |
| Socket coupée, Jellyfin servant | aucun message |
| Épisode suivant | une négociation, sa piste, aucune position héritée |

Non vérifié sur appareil : mpv (bureau), le mobile et les téléviseurs — leur
logique passe par les mêmes règles, testées unitairement.
