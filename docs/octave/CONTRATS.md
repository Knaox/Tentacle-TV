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
| `packages/shared/src/music/musicTypes.ts` | titre, album, artiste, playlist, disponibilité (`library` · `cache` · `pending` · `remote`) ; un titre d'ailleurs dit où mènent son album et ses artistes chez l'extension (`MusicAlbumRef.external`, `MusicArtistRef.external`, optionnels, 25/10 — « Voir l'album / l'artiste » : `jellyfinId` d'abord, sinon `external`, sinon pas de lien ; une extension d'avant ne les envoie pas, rien ne casse) ; un album qui ne se LIT pas porte `unavailable: "notStreamable"` (28/10, posé par l'extension : carte grisée « Pas lisible », la toucher propose de l'aimer ou de l'ajouter à une playlist pour que le serveur le récupère — règle `octave/pages/unavailableAlbum.ts`, aucune capacité) |
| `packages/shared/src/music/musicKeys.ts` | clés stables `jf:<id>` / `ext:<pluginId>:<externalId>`, MBID |
| `packages/shared/src/music/musicPlayback.ts` | `PlaybackSource`, port du moteur `AudioEnginePort` (bascule à chaud `swapSource`) |
| `packages/shared/src/music/musicCoreApi.ts` | routes `/api/music/*` du cœur et leurs réponses |
| `packages/shared/src/music/musicEvents.ts` | événements `music:*` du canal de session |
| `packages/shared/src/music/pluginMusicContract.ts` | contrat `music` du manifeste d'extension (points 1 à 5) |
| `packages/shared/src/plugins/pluginServerRuntime.ts` | runtime ISOLÉ : manifeste `runtime`, IPC, relais HTTP, API d'hôte fermée |
| `serverCapabilities.ts` | `music.library`, `plugins.isolatedRuntime` (serveur 1.40.0) |
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
   **v2 (24/10, additif)** : le client envoie `revise=1` ; une extension v2 peut
   alors rendre d'abord un classement PROVISOIRE (sources rapides,
   `provisional: true`), puis, à chaque curseur (long-poll), la liste ENTIÈRE
   révisée (`replace: true`) — la dernière page `replace` sert de base, les pages
   d'ajout d'après s'y ajoutent. L'anticipation (`prefetch("results")`) attend
   une page non provisoire ; l'interface gèle l'ordre sous le pointeur ou le
   focus et glisse vers le nouvel ordre au relâchement. Une extension d'avant
   ignore `revise` (ajout seul) ; sans `revise`, une extension v2 sert l'ancien
   protocole à l'identique. Un curseur v2 tient au plus 8 s, puis rend la page
   COURANTE avec un nouveau curseur (jamais près des 120 s du relais) ; une
   recherche dont aucun curseur n'est redemandé pendant 10 s est abandonnée.
   Le client n'envoie `prefetch("results")` que pour une page non provisoire,
   une fois par requête.
   **Barre d'Octave (25/10)** : la recherche complète ne part qu'à la VALIDATION
   (Entrée, « Rechercher », une suggestion choisie) ; pendant la frappe, des
   suggestions seulement. Le client ne montre jamais une page `provisional` et
   ne réordonne plus une rangée montrée (la suite s'ajoute dessous).
   **`music.suggest` (optionnel, capacité serveur `music.suggest`)** : GET
   `?q=&limit=` → `MusicSuggestResponse` ; l'extension n'y lit que ses index et
   ses caches, JAMAIS le réseau. Sans capacité ou sans route : suggestions de la
   bibliothèque et recherches récentes seules.
   **Pochettes** : `artworkUrl` peut être une route de l'extension relayée par le
   cœur (`/api/plugins/<id>/…`, servie de son cache) ; le jeton n'accompagne
   jamais une URL d'un autre hôte.
   **Meilleur résultat, playlists, filtres (25/10, additifs)** : une page peut
   porter `top` (`ExternalMusicTop` : un titre, un album, un artiste ou une
   playlist, choisi par l'extension — pertinence ET popularité — avec au plus
   3 titres à lire depuis sa carte) et `playlists` (`ExternalMusicPlaylist`,
   hors bibliothèque : jamais une playlist Jellyfin). `top` absent : rien n'est
   mis en avant ; `top: null` : l'extension dit qu'il n'y en a pas. Le manifeste
   peut déclarer `playlist` (vue : GET `<playlist>/<id>` → `ExternalMusicPlaylist`
   avec `tracks`) et `searchKinds` (liste FERMÉE `tracks · albums · artists ·
   playlists`) : `search?…&kind=<k>` rend une page où seule cette liste est
   remplie — une puce de filtre = UNE requête, au clic. Sans `searchKinds`,
   l'interface filtre la page « Tout » sans requête. Pas de capacité serveur :
   aucune route du cœur ; un serveur d'avant ne relaie ni `playlist` ni
   `searchKinds` (lecture fermée du manifeste), une page traverse le relais telle
   quelle. Un titre (ou un album) externe qui EST un élément de la bibliothèque
   cède sa place à celui de la bibliothèque, PARTOUT où il est montré — règle
   unique `musicLibraryMatch.ts` (MBID, sinon titre de base + artiste commun +
   durée à ± 2 s ; « Various Artists » vaut l'artiste si l'album est le même),
   appliquée par le cœur sur son index (`POST /api/music/match`, capacité
   `music.libraryMatch` 1.40.0 : `{ tracks?, albums? }` → titres par `ref`,
   albums `full`/`partial` et leurs titres). L'extension n'a rien à faire.
   **Radio d'un titre (`music.radio`, 25/10, additif)** : GET
   `<radio>/<externalId>` → `ExternalMusicRadio` (`tracks` : ce que la source
   enchaîne après lui, sans lui), pour la SUITE d'un clic dans les résultats —
   demandée APRÈS le premier son, jamais avant. Radio sans fin : `cursor`
   (absent ou `null` : la fin), la page suivante par `?cursor=<cursor>` ; une
   page suivante peut REDIRE des titres des précédentes, la file les écarte.
   `fetchExternalRadioPage` (api-client) rend la page et son jeton ;
   `fetchExternalRadio`, la 1re page seule.
2. **Source de lecture** — `music.resolve` (POST `{ ids }` → `PlaybackSource`,
   jouable pendant l'écriture : `complete: false`) ; `music.prefetch` reçoit
   l'anticipation (`results`, `hover`, `press` au mousedown/touchstart, `next`).
3. **Gestes** — `music.like`, `music.playlistAdd` : réponse immédiate `pending`,
   le cœur affiche l'état tout de suite.
   **Droits du compte (`music.rights`, 26/10, additif)** : GET `<rights>` →
   `MusicRights` (`shared/music/musicRights.ts`) — `acquire` (peut faire entrer un
   titre : cœur ou playlist d'un titre hors bibliothèque), `dailyLimit` (0 = sans
   limite), `remainingToday`, `keepOffline` (garder hors ligne un titre hors
   bibliothèque), `resetsAt` (minuit, heure du serveur). L'EXTENSION les règle et
   les tient (refus `forbidden` / `quota`) ; Octave cache le bouton sans `acquire`,
   dit « Plus que N ajouts aujourd'hui » près de la limite (`octave/rights/`).
   Sans la route : comportement d'avant (`MUSIC_RIGHTS_BEFORE`).
   **Ambiances (`music.moods` + `music.mood`, 26/10, additif)** : GET `<moods>?lang=` →
   `ExternalMusicMoods` (clé stable, nom dans la langue de l'INTERFACE, couleur, mots de
   recherche) ; GET `<mood>/<id>?lang=` → `ExternalMusicMoodMix` (une playlist hors
   bibliothèque, titres de la bibliothèque du compte en tête, autres playlists de
   l'ambiance) — `shared/music/musicMoods.ts`. Les DEUX ou rien (`hasMoods`), aucune
   capacité serveur. Octave (`octave/moods/`) : rangée « Ambiances » de l'accueil,
   puces de la recherche vide, ambiance NOMMÉE par une recherche (comparée localement
   aux mots, `moodModel.ts`), page `/octave/mood/:id`.
4. **En attente** — `music.pending` : les entrées du compte dans « Titres likés »
   et les playlists, résolues par `music:resolved` (et la synchro Jellyfin). Une entrée
   qui CHANGE D'IDENTITÉ (Sillon : une entrée importée `imp:<clé>` rapprochée de sa
   vidéo, `ytm:t:<vidéo>`) porte ses identifiants d'hier (`formerIds`, additif, 27/10) :
   la copie gardée sous l'ancienne reste reconnue, la tenue à jour la regarde sous la
   nouvelle avant de retirer l'ancienne. Une extension d'avant ne l'envoie pas : rien ne casse.
5. **Navigation et réglages** — `navItems`/`routes` du bundle front ; masqués sans
   extension active, configurée et permise au compte. Les pages vivent dans une
   iframe `sandbox="allow-scripts"` SANS `allow-forms` (`PLUGIN_IFRAME_SANDBOX`,
   `packages/plugins-api/src/iframeSandbox.ts`) : aucun `<form>` dans une extension,
   `submit` n'y part jamais — envoyer au clic et à Entrée (`ActionForm` de Sillon).

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
- Ouvrier yt-dlp : chaque valeur d'`extractorArgs` fait 100 caractères au plus, SAUF
  `youtube.visitor_data` (une seule valeur, base64url `%` `=`, 20–1 024 caractères : le
  visitorData du `visitorStore` de Sillon, avec `player_skip` `webpage`,`configs`). Jamais
  journalisée : refus de l'hôte à message fixe, valeur effacée des messages d'échec de l'ouvrier.
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

## Configuration d'office d'une extension (`configDefaults`, D14b — 26/10)

`/api/plugins/active` ne publie les pages et les contrats d'une extension (`music` compris) qu'avec
`config.enabled === true` ; une installation depuis une source naît avec `config: {}`. Une extension
sans formulaire qui pose cette clé restait donc MUETTE (Octave ne cherchait jamais dans Sillon).
Champ ADDITIF du manifeste : `"configDefaults": { "enabled": true }` — valeurs simples seulement
(booléen, nombre, texte ≤ 256, `null`), 16 clés au plus. Posé à l'installation et à la mise à jour,
et au démarrage pour une extension déjà installée (`services/pluginConfigDefaults.ts`), TOUJOURS
seulement là où la clé MANQUE : un `enabled: false` posé exprès reste coupé. Une extension qui ne
déclare rien (Vigie) garde sa configuration d'avant. Sillon le déclare.

## Requêtes déléguées à l'appareil (lot « Sillon recherche », R3 — capacité `plugins.clientFetch`)

Une extension DÉCRIT une requête HTTP, l'appareil qui l'a sollicitée (le bureau) l'exécute depuis
SA connexion, l'extension analyse la réponse : cent comptes qui cherchent de la musique ne font plus
bloquer l'adresse du serveur. Contrat : `packages/shared/src/plugins/pluginClientFetch.ts`, recopié
dans le backend, le bureau et Sillon (`types/tentacle/`), tests miroirs.

- **Manifeste** : `runtime.clientFetch = { hosts, mediaHosts }` + famille d'API d'hôte `client`.
  Noms PUBLICS exacts (ni IP, ni `localhost`, ni domaine local), https ; `mediaHosts` admet `*.d`.
  Mal formé : le manifeste entier est refusé. Exposé aux clients par `/api/plugins/active`.
- **Chemin** : le bureau s'annonce (`x-tentacle-client-fetch: 1` sur `/api/plugins/*`, tant que
  l'agent tourne) ; le relais pose `RELAY_HEADERS.client` = poignée HMAC (extension, appareil) si
  l'appareil a une socket ouverte ; `client.fetch { client, request }` → l'hôte valide, pousse
  `plugin:clientFetch` sur la socket de CET appareil seulement → le principal Electron revalide
  contre le manifeste qu'il lit LUI-MÊME, plafonne (4 en parallèle, 30/min, 300/h par extension),
  exécute sans cookie (redirections revalidées, adresses privées refusées dans la résolution) →
  `POST /api/client-fetch/:id` (accepté du seul appareil visé ; taille et hôte final revérifiés).
  Jamais une exception pour l'extension : `offline` · `refused` · `timeout` · `budget` · `network` · `tooLarge`.
- **Flux direct** : `PlaybackSource.direct = { url, expiresAt }` (URL liée à l'IP de l'appareil) ;
  `url` reste le chemin du serveur. Le bureau ne donne JAMAIS l'adresse directe à mpv (il poserait
  `X-Emby-Token` dessus) : relais LOCAL 127.0.0.1, repli sur `url` si le direct échoue avant le
  premier octet, 502 ensuite (le moteur redemande la source).
- **Sillon** : la garde YouTube de l'appareil (jamais `tools.youtubeAdmit`, qui compte l'adresse du
  serveur), son visiteur anonyme, le cache des recherches commun ; repli sur le serveur AU CLIC
  seulement, jamais pour une anticipation ; correspondances partagées avec leur provenance (jamais
  par-dessus un jugement du serveur). Le web ne s'annonce pas : chemin serveur inchangé.

## Garder hors ligne la musique (lot « Octave droits », D4 — capacité `offline.music`, BUREAU)

Le MÊME moteur que les films (`packages/offline-core`, miroir du bureau) : un titre gardé est un fichier (`files`,
`claims`, même file, mêmes relances, même contrôle d'espace) ; sa fiche vit dans `music_meta` (palier v11 de la base
locale) et son média se tire d'un chemin du SERVEUR Tentacle (`files.source_path`, validé : `/api/…` seulement — le
jeton ne sort jamais). Albums et playlists gardés en entier : `music_collections`, par compte, dans leur ordre.

| Pièce | Où | Contrat |
|---|---|---|
| Plan de la bibliothèque | `POST /api/music/offline/plan` (`MUSIC_ROUTES.offlinePlan`, `MusicOffline*` de `musicCoreApi.ts`) | `{ ids }` (200 au plus) → `{ tracks: [{ id, variant, preset, path, container, expectedSize, estimatedSize }], refused }`. Session personnelle + `EnableContentDownloading`, sinon 404. Allégé audio `a256` (AAC 256 kb/s, MP4 fragmenté) si `EnableMediaConversion` + conversion du son ET source sans perte ou > 320 kb/s ; sinon l'original. |
| Allégé audio | `/api/downloads/light/:id?preset=a256` (`offlinePrepare/audioLight.ts`) | `Audio/{id}/stream.m4a` de Jellyfin, plafond de débit de l'admin ; `/prepared` ne le sert pas (le bureau tire `/light`, ~50× le temps réel). |
| Titre d'ailleurs | manifeste `music.offline` (Sillon `/music/offline`) | `GET <offline>/<externalId>` → le fichier COMPLET (`Content-Length`, `Range` → 206) ; 503 + `Retry-After` pendant la préparation (le moteur réessaie seul) ; 404 pour un refus ou un titre introuvable. L'extension tient : session personnelle, `users.rights.keepOffline` (hôte : `canUse` + `EnableContentDownloading`, jamais un invité), et ses propres droits (`rights` → `keepOffline`). |
| Lecture | `PlaybackSource.kept { userId }` → `AudioBridgeSource.kept` | La coquille cherche la copie dans SA base (`ipc/audioKept.ts`), revérifiée à chaque lecture ; absente : `url` (le serveur). La page ne désigne jamais un chemin. |
| Coquille | `downloads_music_enqueue` · `downloads_music_list` · `downloads_music_remove` | Pause/reprise/annulation : celles des films. `supportsMusicOffline()` = la coquille sait garder la musique. |
| Interface | `apps/web/src/music/octave/offline/*` | Une porte (`keepRules.ts`, calculée une fois : `MusicOfflineScope`) ; « Sur cet appareil » `/octave/device` ; sans réseau, Octave n'offre qu'elle. |

**Tenir à jour les playlists gardées** (réglage d'APPAREIL `tentacle_octave_offline_autosync`, ALLUMÉ par défaut, « 0 » le coupe ;
`offline/autosync/*`) : allumé, un titre ajouté à une playlist gardée est gardé, un titre retiré quitte l'appareil
s'il n'est RETENU nulle part ailleurs (album, autre playlist, titre gardé seul = collection `track`) ; une copie
d'ailleurs est remplacée par sa version Jellyfin (`music:resolved`, `POST /api/music/match`) et une forme changée par
l'administration (plan) refaite — l'ancien fichier n'est retiré qu'une fois le nouveau complet. Relevé complet à
l'ouverture et à la reconnexion ; `music:playlist`, `music:library` (ajout ou mise à jour), `music:resolved` sinon ;
la règle rejouée à chaque fin de transfert. Aucune capacité nouvelle (`offline.music` couvre). Règle pure
`syncPlan.ts`, mécanique `syncRunner.ts`.

## Synchro temps réel

Le cœur écoute les sockets Jellyfin des comptes (`jellyfinUserEvents.ts`) et émet
`music:library`, `music:userdata`, `music:playlist` ; il pousse aussi
`jellyfin.audioItems` à l'invité. Sillon émet `music:resolved` (élément Jellyfin
trouvé pour un titre en attente) et `music:pending`. Le lecteur bascule la source
du titre courant ET de la file (`swapSource`) sans action de l'utilisateur.

Le cœur émet aussi `music:listPrefs` { key } à chaque `PUT /api/music/lists/:key/prefs` : les autres appareils
du compte relisent CE tri (l'appareil qui l'envoie ignore son écho tant que ses envois partent,
`isSavingListPrefs`). Chaque application monte UNE souscription (`useMusicEvents`) et applique l'effet commun
`applyOctaveEvent` (api-client) : bureau `useOctaveEvents`, mobile `OctaveEventsHost` (overlay de la coquille).

## Partage d'une playlist (capacité `music.playlistShare`, 1.40.0)

Contrat `musicShare.ts` (recopié dans le backend). UN lien par playlist et par compte
(`music_playlist_shares`, jeton de 16 octets en base64url), créé, lu et révoqué par
`/api/music/playlists/:id/share` ; gardé par le droit « Partage public » (`EnablePublicSharing`, le même que
Ma liste) — ni « voir en tant que », ni un invité de la Famille ; effacé avec sa playlist. Qui a le lien lit
`/api/music/share/:token` (SANS compte : nom, description, nom du compte, et pour chaque titre titre, artistes,
album, durée, enregistrement MusicBrainz — jamais un identifiant Jellyfin, un fichier, une image, un jeton),
relu à chaque fois dans les droits du propriétaire. La page `/octave/share/:token` (servie interface web
coupée comprise, sans script) propose « Importer dans mon Tentacle » (renvoi vers `<son serveur>/octave/import
?share=<lien>`) et l'app (`tentacle://octave/import?share=<lien>`).

Importer : le lien est une source d'import `tentacle` (`recognizeTentacleShare`). Le serveur qui importe lit le
document par une porte gardée (`shareFetch.ts` : HTTPS, adresses internes refusées À LA RÉSOLUTION, aucune
redirection, 2 Mio ; `TENTACLE_SHARE_IMPORT_PRIVATE=on` ouvre la maison), un jeton de CE serveur se lit sans
réseau, puis la machine d'import habituelle : chaque titre rapproché de SA bibliothèque (MBID compris), les
absents à son extension sous la source `text` (une extension d'avant refuserait `tentacle`).

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
