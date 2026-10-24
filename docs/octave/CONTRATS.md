# Octave — contrats du lot (étape A)

Le mode musique de Tentacle (« Octave ») et son extension « Sillon » (dépôt
`Tentacle-Plugin-Sillon`, à côté de `Tentacle-Plugin-Seer`). Ce fichier dit QUI
parle À QUI, et par quel contrat. Les agents codent contre ces contrats, jamais
les uns contre les autres ; une évolution passe par le coordinateur.

## Répartition

| Couche | Où | Ce qu'elle sait |
|---|---|---|
| Cœur Tentacle | ce dépôt | la bibliothèque musique JELLYFIN, le lecteur, le runtime d'extensions, le mode Octave. **Rien** de hors bibliothèque, aucun Lidarr, aucune source nommée, yt-dlp jamais pour la musique. |
| Sillon | `Tentacle-Plugin-Sillon` | catalogue MusicBrainz, lecture hors bibliothèque (yt-dlp de Tentacle par l'API d'hôte), Lidarr, re-liaison. |

Source de vérité = **Jellyfin** : le cœur (« j'aime ») EST le favori Jellyfin du
compte ; une playlist EST une playlist Jellyfin. Aucun stockage propre au cœur.

## Fichiers de contrat

| Fichier | Contenu |
|---|---|
| `packages/shared/src/music/musicTypes.ts` | titre, album, artiste, playlist, disponibilité (`library` · `cache` · `pending` · `remote`) |
| `packages/shared/src/music/musicKeys.ts` | clés stables `jf:<id>` / `ext:<pluginId>:<externalId>`, MBID |
| `packages/shared/src/music/musicPlayback.ts` | `PlaybackSource`, port du moteur `AudioEnginePort` (bascule à chaud `swapSource`) |
| `packages/shared/src/music/musicCoreApi.ts` | routes `/api/music/*` du cœur et leurs réponses |
| `packages/shared/src/music/musicEvents.ts` | événements `music:*` du canal de session |
| `packages/shared/src/music/pluginMusicContract.ts` | contrat `music` du manifeste d'extension (points 1 à 5) |
| `packages/shared/src/plugins/pluginServerRuntime.ts` | runtime ISOLÉ : manifeste `runtime`, IPC, relais HTTP, API d'hôte fermée |
| `serverCapabilities.ts` | `music.library`, `plugins.isolatedRuntime` (serveur 1.32.0) |
| Sillon `types/tentacle/*` | MIROIR des fichiers ci-dessus (on modifie ici, puis on recopie) |
| Sillon `server/contracts/*` | catalogue, cache audio, réglages, contexte des routes |
| Sillon `server/storage/migrations/*` | schéma SQLite propre (`plugin.db`) : `core` 1-99, `playback` 100-199, `library` 200-299 |

Imports : `@tentacle-tv/shared/music`, `@tentacle-tv/shared/pluginServerRuntime`.
Le backend ne dépend pas de shared : il RECOPIE ce dont il a besoin (miroir + test),
comme `serverCapabilities.ts`.

## Les 5 points d'extension (génériques, rien de nommé)

Déclarés dans `plugin.json` → `music` (lu par `readPluginMusicManifest`), relayés
aux clients par `/api/plugins/active` (champ `music`), routes de l'extension sous
`/api/plugins/<id>`.

1. **Recherche** — `music.search` : pages PROGRESSIVES (`complete`, `cursor`). Le
   client fusionne : un résultat externe dont le MBID d'enregistrement est déjà
   dans la bibliothèque est retiré (la bibliothèque gagne).
2. **Source de lecture** — `music.resolve` (POST `{ ids }` → `PlaybackSource`,
   jouable pendant l'écriture : `complete: false`) ; `music.prefetch` reçoit
   l'anticipation (`results`, `hover`, `press` au mousedown/touchstart, `next`).
3. **Gestes** — `music.like`, `music.playlistAdd` : réponse immédiate `pending`,
   le cœur affiche l'état tout de suite.
4. **En attente** — `music.pending` : les entrées du compte dans « Titres likés »
   et les playlists, résolues par `music:resolved` (et la synchro Jellyfin).
5. **Navigation et réglages** — `navItems`/`routes` du bundle front ; masqués sans
   extension active, configurée et permise au compte.

Garde partout : capacité serveur `plugins.isolatedRuntime` ET extension active
déclarant `music` ET droit du compte (`users.rights` → `canUse`). Sinon : aucun
code chargé, aucune trace dans l'interface.

## Runtime isolé (agent 5 hôte ; amorce invitée dans Sillon `server/runtime/`)

- Processus à part (`node --permission`, lecture : dossier de l'extension ;
  écriture : son dossier de données). Aucun accès à `tentacle.db` ni aux secrets.
- L'invité écoute HTTP sur la socket `TENTACLE_PLUGIN_SOCKET` ; l'hôte relaie
  `/api/plugins/<id>/*` après `requireAuth` (sauf `publicRoutes`), retire
  `Authorization`, cookies et `x-tentacle-*` du client, pose `RELAY_HEADERS`.
  Le relais transmet `Range` et diffuse les corps en flux (audio).
- API d'hôte FERMÉE (`HOST_METHODS`) par IPC ; famille non déclarée → `forbidden`.
- Outils : liste blanche par l'administrateur, arguments validés par Zod côté
  hôte ; ouvrier persistant (`tools.spawnWorker`) = l'interpréteur de l'outil
  qui charge un script du dossier de l'extension (yt-dlp en bibliothèque Python,
  importée depuis le zipapp en service). Le chemin et la mise à jour de yt-dlp
  restent ceux du cœur (`services/ytDlp.ts`), inchangés pour les bandes-annonces.
- **Budget YouTube UNIQUE de l'hôte** (lot « Sillon vitesse », S6) : une seule
  adresse IP sert les bandes-annonces ET les extensions. `tools.youtubeAdmit
  { kind: "play" | "prefetch", cost: 1..4 }` → `{ granted: true, waitMs }` ou
  `{ granted: false, reason: "blocked" | "budget", retryAfterMs }` ;
  `tools.youtubeReport { outcome: "ok" | "antiBot", startedAt }`. Registre de
  l'hôte (`services/youtubeBudget/`) : 150/h et 20/min toutes sources ; une
  extension en `play` sous 140, en `prefetch` sous 110 (≥ 40/h restent toujours
  aux bandes-annonces et aux clics), 100/h chacune, cadence 250 ms. Disjoncteur
  COMMUN (celui des bandes-annonces) : `antiBot` l'ouvre, une lecture-sonde
  d'extension toutes les 5 min, un `ok` parti après l'ouverture le referme. Les
  bandes-annonces ne sont refusées qu'à l'heure pleine (150) : en deçà, leur
  comportement est inchangé. Réservé à la famille `tools` avec un outil demandé
  au manifeste. Toute requête vers youtube.com / music.youtube.com / InnerTube
  d'une extension passe par lui — par l'ouvrier comme en HTTP direct. Hôte
  d'avant : `forbidden` (méthode inconnue) → l'extension garde sa garde locale.
- Extension désactivée → `shutdown`, plus aucun relais, `music:provider` émis.
- Repli si le runtime se révèle trop risqué : conteneur séparé, MÊME contrat HTTP.

## Synchro temps réel

Le cœur écoute les sockets Jellyfin des comptes (`jellyfinUserEvents.ts`) et émet
`music:library`, `music:userdata`, `music:playlist` ; il pousse aussi
`jellyfin.audioItems` à l'invité. Sillon émet `music:resolved` (élément Jellyfin
trouvé pour un titre en attente) et `music:pending`. Le lecteur bascule la source
du titre courant ET de la file (`swapSource`) sans action de l'utilisateur.

## Flux « aimer hors bibliothèque »

`like` → opération `queued` → cache complet (format natif, jamais ré-encodé, tags
MusicBrainz) → import manuel Lidarr avec MBID → Lidarr déclenche le scan →
`jellyfin.audioItems`/`findByMbid` → favori posé pour CE compte (ou insertion à la
position) → `music:resolved`. Upgrade : webhook Lidarr → nouvel élément → favoris
et positions reposés pour TOUS les comptes (`usageOf` pris avant) → aucun doublon.

## Cibles mesurées

Recherche locale < 100 ms · premiers résultats extension < 1 s · titre de la
bibliothèque < 300 ms · hors bibliothèque pré-bufferisé < 200 ms, pré-résolu
< 500 ms, à froid < 1,5 s · gapless, bascule cache → bibliothèque comprise.
