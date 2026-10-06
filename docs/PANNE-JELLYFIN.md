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
`outageView` (phases, 15 s de reprise muette) et `useOutageGate` (erreurs tues
pendant la panne). Les phrases : `jellyfinOutageCopy` (shared). Web, bureau et
webOS : `useWebPlaybackProblem` + `JellyfinOutageNotice` ; mobile :
`usePlayerProblem` + `JellyfinOutageBanner` ; Apple TV et Android TV : l'état
vaut une sonde qui fait foi dans leur reprise (tv-core `serverOutage.ts`,
`useServerJellyfinHealth`).

### Le retour est transparent (retour de Damien, 2026-10-06)

Avant, le flux se rouvrait TOUJOURS au retour : une vidéo qui tenait sur sa
réserve était rechargée. Désormais (shared `jellyfinReturn.ts`) :

- la lecture qui a tenu continue, RIEN ne se recharge ; le serveur redit la
  lecture à Jellyfin, qui l'a oubliée : `/Sessions/Playing` puis `/Progress`,
  à la position extrapolée (`PlaybackReporter.resync`, retentée sur 503), et
  un `/Progress` de plus 10 s après pour un transcodage ;
- le lecteur reprend son flux seul au bout de sa réserve : `<video>` et mpv
  se reconnectent, hls.js et mpv redemandent le segment suivant et Jellyfin
  relance l'encodage à ce segment ;
- le flux ne se rouvre (même position, mêmes pistes) que s'il le faut : la
  lecture n'avait pas démarré, le flux est mort PENDANT la panne (erreur tue),
  ou, dans les 3 min après le retour, une erreur ou une image arrêtée plus de
  5 s. Une fois par retour. Une nouvelle panne referme cette fenêtre.

Les messages sont TEMPORAIRES (`useOutageNotice`) : 10 s, compte à rebours
visible (« Disparaît dans N s »), 20 s pour « ne répond toujours pas » qui
garde « Réessayer » ; ils reparaissent à chaque nouvel état de Jellyfin. Le
retour se passe sans un mot. Le voile plein écran « serveur injoignable » du
web et du mobile cède au message du lecteur quand la panne est dite par le
serveur (`veilYieldsToPlayer`) — il recouvrait une vidéo qui jouait encore.

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

## Mesuré le 2026-10-06 : le retour transparent

Banc réel : Jellyfin 10.11.11 jetable (conteneur `pj-jf-10.11`, colima),
MariaDB et backend à soi, un film de 10 min à 6 Mb/s (460 Mo), compte
Knaoxtest du Jellyfin jetable ; vraie app web (Chrome du volet) et vrai
Electron (profil jetable, `CFFIXED_USER_HOME`). Jellyfin a mis 8 à 45 s à
revenir selon le geste (colima). Côté Jellyfin, `/Sessions` relevé toutes
les 0,5 s ; côté lecteur, évènements `<video>`, requêtes de flux, cache et
`loadfile` de mpv.

| Lecteur, geste | Réserve | Ce qui se passe au retour |
|---|---|---|
| Web, lecture directe, `docker restart` (30 s) | ≈ 50 s (Chrome garde plus que `buffered`) | rien : image continue, aucun `loadfile`, aucune requête de flux |
| Web, direct, `POST /System/Restart` (39 s) | idem | rien ; session redite chez Jellyfin 0,5 s après son retour |
| Web, direct, `docker stop` 145 s | épuisée à +52 s, `error` du `<video>` tue | rouvert (flux mort pendant la panne) à 248,6 s exactement, image en 0,7 s |
| Web, transcodage 540p (hls.js), restart 9 s | 120 s | rien : hls.js redemande le segment suivant, Jellyfin relance l'encodage |
| Web, transcodage, `docker stop` 72 s | 120 s | rien : hls.js retente toutes les ~8 s, aucune erreur fatale |
| Bureau (mpv), direct, restart 16 s | tout le fichier (545 s, 512 Mio) | rien : un seul `loadfile`, cache 533 → 465 s |
| Bureau, transcodage, restart | 260 s | AVANT correctif : ffmpeg a sauté tous les segments sur les 503, mpv est sorti sur une fausse fin du film (490/600 s). Après : rouvert au retour, reprise à la position |

- Les messages : « s'arrête » → « est arrêté » → « redémarre — presque
  prêt », chacun décompté 10 → 1 puis effacé ; au retour, effacé aussitôt.
  Le décompte se suspend fenêtre cachée (volet du navigateur masqué).
- Le voile « Oups, le serveur fait une pause ! » recouvrait la vidéo qui
  jouait : il cède désormais au message du lecteur (`veilYieldsToPlayer`).
- La socket de l'appareil chez Jellyfin rouvre PENDANT son démarrage : la
  redite se fait au retour dit par la santé (API authentifiée prête), pas à
  la réouverture de la socket (45 s de démarrage relevés).
- La redite d'un transcodage arrive avant que l'encodage ne renaisse :
  Jellyfin l'enregistre « DirectPlay » ; un report de plus 10 s après.
- `console.info` est retiré du build : les décisions s'écrivent en
  `console.warn`, « [panne] Jellyfin revenu : lecture gardée… » ou
  « [panne] flux rouvert : <cause> ».

Non joués sur appareil : le mobile, l'Apple TV, Android TV — leur logique
passe par les mêmes règles partagées, testées unitairement.
