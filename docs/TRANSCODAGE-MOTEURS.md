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
