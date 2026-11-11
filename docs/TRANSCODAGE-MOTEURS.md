# Transcodage — ce que lit le moteur décide de ce qu'on demande à Jellyfin

Une seule règle pour tous les lecteurs (web, bureau mpv, mobile ExoPlayer/mpv/AVPlayer,
Apple TV, Android TV, LG) : chaque client **déclare ce que son moteur décode**, et la
règle partagée en tire les paramètres de transcodage.

- Déclarations des moteurs : `packages/shared/src/playback/engineCapabilities.ts`
  (`MPV_ENGINE`, `AVPLAYER_ENGINE`, `EXOPLAYER_ENGINE`, `SAFE_FALLBACK_ENGINE`, `withHdr`).
- Règle : `packages/shared/src/playback/streamPlan.ts` (`planStream`, `audioCodecParam`,
  `keptAudioCopyBitrate`) et `engineProfiles.ts` (`engineTranscodingProfiles`, pour un
  `DeviceProfile`).
- URL fabriquée par le client (bureau, téléviseurs) : `buildStreamUrl` (api-client) avec
  `engine` et `sourceAudio`. URL rendue par Jellyfin (web, mobile, LG) : le palier y est
  posé par `applyTranscodeTarget(url, tier, mediaSource)`.

## Faits mesurés (banc du 06/10, Jellyfin 10.11.11, logiciel, `lq-jf`)

Médias générés : DTS 5.1 à 768 kb/s, HEVC Main 10 HDR10 4K, Dolby Vision 8.1 (RPU injecté
par `dovi_tool`, multiplexé par `mkvmerge`), deux épisodes H.264 1080p.

1. **Le son n'est copié que si `AudioBitrate` couvre la piste source.** `AudioCodec` avec
   `dts` mais `AudioBitrate=384000` → `libfdk_aac`. `AudioBitrate=768000` → `-codec:a:0 copy`.
   Jellyfin, par PlaybackInfo, pose de lui-même `AudioBitrate` au débit de la piste quand
   le profil déclare le codec, et retire ce débit du budget vidéo.
2. **`AudioCodec` (et `VideoCodec`) : 40 caractères au plus**, sinon 400
   (« must match `^[a-zA-Z0-9\-\._,|]{0,40}$` »).
3. **Par PlaybackInfo, un profil HLS en TS ne garde que `aac,ac3,eac3,mp3`** : le DTS y est
   converti. En fMP4, il est gardé et copié. Une URL fabriquée par le client, elle, copie le
   DTS en TS (`-codec:a:0 copy -strict -2`).
4. **Un réencodage perd TOUJOURS le HDR et le Dolby Vision**, en H.264 comme en HEVC :
   `IsSwTonemapAvailable` ne regarde que la source (HDR, 10 bits), jamais la plage demandée
   (`hevc-rangetype`), et `main10` est ramené à `main` (`GetVideoQualityParam`). Vérifié
   aussi dans les sources de `master`. Même l'URL que Jellyfin fabrique lui-même
   (`hevc-profile=main10`) sort `-profile:v main … tonemapx … format=yuv420p`.
5. **Le HDR et le Dolby Vision survivent à une COPIE** : `-codec:v:0 copy -tag:v:0 dvh1`,
   manifeste `VIDEO-RANGE=PQ`, `SUPPLEMENTAL-CODECS="dvh1.08.06/db1p"`, en TS comme en fMP4 —
   à condition que `VideoCodec` contienne le codec, que `<codec>-rangetype` contienne la
   plage, et qu'**aucun `MaxWidth` inférieur à la source** ne soit posé (l'ancien
   `MaxWidth=1920` du remux réencodait et tone-mappait toute source 4K).
6. **Le HEVC n'est encodé que si l'administrateur l'a permis** (`AllowHevcEncoding`,
   « Autoriser l'encodage HEVC », éteint par défaut) ; sinon Jellyfin prend le codec suivant
   de `VideoCodec`. En logiciel, x265 coûte ~10 fois x264 (premier segment 1080p : 13 s
   contre 1,3 s sur le banc) : c'est un réglage pour un serveur à encodeur matériel.
7. **Le tableau de bord** : `TranscodingInfo` n'est attaché qu'à une session qui a déclaré
   sa lecture (`/Sessions/Playing`). Jellyfin réécrit en `DirectPlay` un `Transcode` déclaré
   sans encodage vivant, et tue l'encodage d'un titre à son `Stopped`. Un `Stopped` du titre
   précédent arrivé APRÈS le `Playing` du suivant efface le titre en cours de la session
   jusqu'au report suivant.

## Ce qui en découle

- Le HEVC est déclaré en tête dès que le moteur le décode (l'admin garde la main).
- Le son est copié quand le moteur le lit, s'il pèse au plus 25 % du palier
  (`AUDIO_COPY_MAX_SHARE`) ; sinon converti, avec la vraie raison
  (`AudioCodecNotSupported`, `AudioChannelsNotSupported`, `AudioBitrateNotSupported`).
- Jamais d'AC3/E-AC3 copié vers du fMP4 (init au `moov` vide, cf. mémoire du 31/08).
- Un palier choisi sur une source HDR sort en SDR : limite de Jellyfin, dite par le
  tableau de bord (« HDR10 → SDR » quel que soit le codec de sortie).
- L'épisode suivant refait la mesure du débit (`itemBitrate.ts`, api-client) avant de
  choisir son flux, attendue au plus 2,5 s.

## Android TV — le moteur déclare d'après l'APPAREIL (07/10, mode Lite)

Sur Android TV, ExoPlayer lit d'abord (mpv seulement après une erreur d'Exo). Ses
déclarations ne sont plus des listes fixes : elles viennent du profil de l'appareil.

- **Le relevé** (`apps/tv/android/.../media/`, module `TentacleMediaCapabilities`) :
  décodeurs vidéo MATÉRIELS vus comme ExoPlayer les voit (`MediaCodecUtil` de Media3 ;
  `c2.android.*`, `c2.google.*`, `OMX.google.*` écartés), profils et niveaux dans les mots
  de Jellyfin, cadence tenue en 720p / 1080p / 2160p (le test de Media3), 10 bits ; profils
  Dolby Vision ; plages HDR de l'écran ; son HDMI (`AudioCapabilities` de Media3) et sons
  décodés (plateforme + extension FFmpeg) ; mode de sortie. Lu à la première ouverture du
  lecteur, relu sur un changement d'écran ou d'HDMI. Forme : `DeviceMediaProfile`
  (`packages/shared/src/playback/deviceMediaProfile.ts`).
- **Les moteurs** : `exoPlayerEngineFor` / `mpvEngineFor` (`deviceEngines.ts`). Un codec
  n'est déclaré que s'il a un décodeur matériel ; le HDR suit le décodeur HEVC 10 bits (pas
  l'écran : la box ramène elle-même le HDR10 au SDR) ; le Dolby Vision, un décodeur du
  profil 5. Les sons des segments d'ExoPlayer restent ceux mesurés (ni DTS ni TrueHD en TS).
  Sans profil : les déclarations fixes.
- **Le verdict** (`devicePlaybackVerdict.ts`) : lecture directe, flux direct (image copiée,
  son converti), transcodage (image réencodée) ou refus. Jamais le décodage LOGICIEL d'une
  image : l'extension FFmpeg du lecteur décode H.264 et HEVC sur le processeur, et un
  Cortex-A53 ne le tient pas. Le niveau est relevé mais ne décide pas (un H.264 de niveau
  5.1 en 1080p, courant, serait refusé à tort) ; la taille et la cadence sont le vrai test.
- **L'AV1 sans décodeur** (décision du 07/10) : le serveur convertit — HEVC si
  l'administrateur l'a permis, sinon H.264 —, à la définition de l'écran au plus
  (`planStream.outputMaxHeight`), et le lecteur le dit une fois : « Cet appareil ne lit pas
  l'AV1 : le serveur convertit » (`player:deviceNotice.av1Converted`).
- **Le banc** : `adb shell setprop debug.tentacle.media_profile bcm7271` injecte le profil
  simulé de la box net+ (`simulatedDeviceProfiles.ts`) ; `survey` fait écrire le profil réel
  dans `logcat -s TentacleMedia` 5 s après le lancement, sans une touche. Écouté par l'app
  de mesure (`*.perf`) et une construction de développement seulement.
- La matrice de la fiche (11 images × 5 sons × 3 sous-titres) est un test de la règle :
  `devicePlaybackVerdict.test.ts`.

## Le lecteur web du bureau CEF — sans H.264 ni AAC (11/11)

Quand mpv ne lit pas (absent, initialisation ratée, chute en pleine lecture),
le bureau passe au lecteur web (`<video>` + hls.js). Sous CEF (binaires publics
de Chromium), ce lecteur ne décode ni H.264, ni HEVC, ni AAC, ni AC-3 : le
profil d'un navigateur ordinaire lui valait un flux H.264 + AAC en TS,
`manifestIncompatibleCodecsError`, et « La lecture n'a pas pu démarrer ».

- **Le moteur se déclare** : `openWebEngine(probe)` (`engineCapabilities.ts`),
  d'après `MediaSource.isTypeSupported` (`lib/deviceProfile/codecs.ts`). AV1
  seul à la sortie, Opus pour le son converti (puis FLAC, MP3), fMP4, HDR10 et
  HLG si l'AV1 10 bits se décode, pas de Dolby Vision. `null` pour qui lit le
  H.264 et l'AAC : son profil d'avant, à l'octet.
- **Le profil** (`lib/deviceProfile/openProfile.ts`) : UN profil HLS fMP4
  `av1` / `opus,flac,mp3` (`engineTranscodingProfiles`, `universalFallback:
  false` — ni le repli H.264 + AAC en TS, ni l'AAC du profil audio), et la
  condition de plage de l'AV1.

Mesuré sur le Jellyfin réel (12.4.0, encodeur matériel), par `PlaybackInfo` :

| Source | Demande | Ce que Jellyfin rend |
|---|---|---|
| AV1 4K Dolby Vision (base HDR10) + E-AC3 | `av1` + `opus` | image COPIÉE (`av01.0.12M.10`, PQ), son en Opus ; init en 0,5 s, 1er segment en 0,08 s |
| H.264 1080p + DTS | `av1` + `opus` | ENCODÉ en AV1 (`av01.0.15M.08`) + Opus ; init 0,5 s, 1er segment 0,07 s |
| HEVC 1080p + AC3 | `av1` + `opus` | ENCODÉ en AV1 + Opus ; init 0,9 s, 1er segment 0,23 s |
| H.264 1080p + DTS | `av1,vp9` + `opus` | **rien** : maître sans codec vidéo, init en 502 après 30 s |

D'où deux règles : **jamais le VP9 dans la liste HLS** (Jellyfin le choisit
alors, et ne sert rien — une source VP9 passe par la lecture directe, sinon
elle est convertie en AV1), et **l'encodage AV1 doit être permis** dans Jellyfin
(« Autoriser l'encodage AV1 ») : sans lui, Jellyfin rend autre chose que ce
lecteur ne lit pas — non mesuré ici (le serveur réel le permet), le lecteur web
le dirait par son écran de problème. Sur la bibliothèque réelle (120 premiers
films) : 101 HEVC, 17 H.264, 2 AV1 — le lecteur de secours CONVERTIT presque
toujours, et un réencodage perd le HDR (fait 4) ; seule une source AV1 garde le
sien, que Chromium ramène à l'écran.

**Le repli lui-même** (`Watch.tsx`, `lib/fallbackPlayer.ts`,
`hooks/playbackFailure.ts`). Un échec d'initialisation de mpv et une fin de
fichier dont le code accuse le moteur (−2, −3, −14, −15, −20) sont des défauts
du LECTEUR, dits tels quels (`engineFailed`) : ni le texte de l'erreur
(« mpv-init-timeout » devenait « le serveur met trop de temps à répondre »), ni
une sonde du flux qui n'aboutit pas (« connexion perdue ») ne les reclassent
plus. La bascule emporte le titre et la position de l'arrêt : le lecteur web
reprend là. Vu sur l'instance réelle : chute provoquée à 1 313,36 s, reprise à
1 313,4 s, première image 5 s après la chute. Provoquer la panne :
`TENTACLE_MPV_FAULT`, `mpv_debug_fault` (`apps/desktop-cef/README.md`).
