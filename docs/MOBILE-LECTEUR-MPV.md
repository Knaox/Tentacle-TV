# Le lecteur mobile — deux moteurs, zéro transcodage

Chantier `feat/mobile-mpv` (2026-09-20), version mobile **1.8.0**. Objectif : sur
iOS et Android, le fichier Jellyfin se lit **tel quel** — toutes ses pistes, tous
ses sous-titres, en ligne et hors ligne — sans transcodage ni remux serveur, hors
une liste fermée. Ce document est la référence de ce qui a été décidé, mesuré,
et de ce qui reste ouvert.

## 1. Architecture

Deux moteurs par plateforme derrière **une** façade JavaScript :

| | Lecteur système (« natif ») | Lecteur avancé (« mpv ») |
|---|---|---|
| iOS | AVPlayer via react-native-video | libmpv par **MPVKit** (fork Streamyfin, `vo=avfoundation` → `AVSampleBufferDisplayLayer`, `ao=audiounit`, `hwdec=videotoolbox`) |
| Android | ExoPlayer/Media3 via react-native-video (+ extension FFmpeg de Jellyfin) | libmpv par **libmpv-android** (`vo=gpu-next`, `gpu-context=android`, `hwdec=mediacodec-copy`, `ao=aaudio`) — **écrit, jamais compilé** |

- Module natif : `apps/mobile/modules/mpv-player/` (Swift et Kotlin, dérivés de
  Streamyfin, en-têtes MPL-2.0). Contrat identique des deux côtés : événements
  `onLoad`, `onProgress`, `onBuffering`, `onEnd`, `onError`, `onTracksChanged`,
  `onPipChanged`, `onPlaybackStateChange`, `onAirPlayRoute` ; commandes
  `seekTo`, `setAudioTrack`, `setSubtitleTrack`, `addSubtitle`, `stop`,
  `startPictureInPicture`… (`src/MpvPlayer.types.ts`).
- Façade : `apps/mobile/src/player/engine/` — `engineRouter.ts` (pur, testé),
  `trackMapping.ts` (pur, testé), `engineSettings.ts` (réglages d'appareil),
  `usePlayerEngine.ts` (décision, repli, AirPlay), `NativeVideoSurface.tsx`,
  `MpvVideoSurface.tsx` ; `components/player/PlayerVideoSurface.tsx` répartit.
- Profils Jellyfin par moteur : `lib/{ios,android}DeviceProfile.ts` (natif) et
  `lib/{ios,android}MpvDeviceProfile.ts`, tous dérivés des ensembles de
  `packages/offline-core/src/variants/platformSupport.ts` — la **source
  unique** de ce que chaque moteur lit (routeur, profils, hors ligne).
- Identité des pistes : `MediaStream.Index` Jellyfin = index ffprobe =
  `track-list/N/ff-index` de mpv ; les externes se retrouvent par
  `external-filename`. Sélection appliquée après `MPV_EVENT_FILE_LOADED`.

## 2. Règles du routeur (`decideEngine`)

Décidé une fois par élément, AVANT PlaybackInfo, sur les flux et les pistes par
défaut ; un repli ou AirPlay peuvent ensuite imposer l'autre moteur pour la
session ; jamais de retour automatique vers le lecteur avancé.

Ordre iOS : réglage forcé → AirPlay actif → natif · Dolby Vision profil 5 → natif
· « Préférer l'Atmos du système » (opt-in) + E-AC-3 JOC → natif · **AV1 sans
puce AV1 → natif** (voir §6) · conteneur non natif → mpv · codec vidéo non
natif → mpv (AV1 natif seulement avec la puce) · H.264 > 8 bits → mpv · codec
audio non natif → mpv · codec de sous-titre non natif (ASS, PGS…) → mpv ·
sinon natif.

Android : réglage forcé → conteneur → codec vidéo → codec audio → sous-titre
(ASS → mpv si « sous-titres stylés » est actif) → natif.

Repli après échec d'une lecture directe : l'autre moteur s'il est plausible
(`nativeMediaPlausible`), sinon la relance transcodée ; motif exposé dans
« Détails » de l'écran d'erreur (`engine · reason`).

## 3. La liste fermée (ce qui a le droit de passer par le serveur)

1. Plafond de débit / palier de qualité choisi par l'utilisateur.
2. **AirPlay** avec un média non natif : bascule mpv → natif à la même position,
   remux ou transcodage acceptés (mesuré : DirectPlay 500,8 s → Transcode mp4,
   h264 copié, aac, à 501 s).
3. **Dolby Vision profil 5** sur iOS (le lecteur système seul le rend).
4. Échec des deux moteurs en lecture directe.
5. « Préférer l'Atmos du système » (opt-in, iOS).
6. **AV1 sans puce AV1 (iOS)** — ajouté ce chantier, réversible : voir §6.

Hors ligne : personne ne transcode. L'original est offert dès que l'union des
deux moteurs le lit ; la carte « qualité d'origine (MP4) » (remux `pmax`) n'est
plus proposée, les entrées existantes se lisent toujours.

## 4. Vérifié (iPhone 17 Pro, simulateur, iOS 26.3)

Preuve = `GET /Sessions` : `PlayMethod=DirectPlay`, aucun `TranscodingInfo`,
`AudioStreamIndex`/`SubtitleStreamIndex` conformes ; journal mpv (`Decoder
format`, `aid`/`sid`) ; une seule négociation PlaybackInfo par lecture.

| Cas | Résultat |
|---|---|
| MKV H.264 / AC-3, sous-titres SRT | DirectPlay, mpv |
| MKV HEVC 10 bits (p010) | DirectPlay, mpv |
| MKV 4K Dolby Vision 8.1 + DTS-HD | DirectPlay, mpv |
| MKV 4K HDR10 ; MKV HDR10+ TrueHD Atmos 7.1 (1917) | DirectPlay, mpv ; bascule audio TrueHD et sous-titre SRT dans le moteur, saut exact |
| AVI MPEG-4 / MP3 | DirectPlay, mpv |
| ASS stylé (typesetting), PGS | Rendus par mpv (libass), sans transcodage |
| Changement audio / sous-titre | `aid`/`sid` dans le moteur, zéro renégociation, index remontés à Jellyfin |
| Reprise de position, sauts | Exacts (`hr-seek`) |
| Dolby Vision profil 5 | Natif (Transcode serveur — liste fermée) |
| AirPlay simulé en cours de lecture | mpv → natif à la même seconde (Transcode, liste fermée) |
| Hors ligne : MKV original (Kassos, h264/aac, SRT intégré) | Fichier complet (39 270 415 o), aucun side-car, lu localement par mpv, sous-titre intégré basculé (`sid`), aucune session serveur |
| Hors ligne : Allégé p720 (MP4 h264/aac, side-car `2-fra.vtt`) | Lu localement par le lecteur système (routeur sur le FICHIER gardé), sous-titre du side-car à l'écran |
| Réglages › Lecture (moteur, Atmos, taille/position) | Écrits, typés ; **non exercés à l'écran** au simulateur |
| AV1 10 bits (4 fichiers) | **Plantage** de libdav1d à l'ouverture (§6) |

Tailles : `.app` Debug simulateur 97 Mo → 145 Mo ; tranche `ios-arm64` du
xcframework MPVKit : 128 Mo (statique — le binaire final embarque ce que
l'éditeur de liens retient). Android : ~24 Mo par ABI (libmpv) + 1,4 Mo
(décodeur FFmpeg), **non mesuré sur une build**.

Spécificités du simulateur : `hwdec=no`, `avfoundation-composite-osd=no` (les
sous-titres y sont dessinés grands, dans une couche séparée — artefact du
simulateur), PiP « non pris en charge », pas d'AirPlay.

## 5. Obligations de licence avant soumission à l'App Store

Les binaires du tag `0.41.0-av5` du fork sont **GPL** (Samba, `-Dgpl=true`) :
développement et TestFlight seulement.

1. Lancer `.github/workflows/mpvkit.yml` (dispatch manuel) → Release
   `mpvkit-lgpl-0.41.0-av5` (mpv `-Dgpl=false`, FFmpeg sans `--enable-gpl`,
   sans libsmbclient ni LuaJIT ; garde-fou `nm` sur `smbc_`/`lua_`).
2. Reporter URL et SHA-256 dans `apps/mobile/ios/MPVKit.podspec` (`version`,
   `license`, `:http`, `:sha256`), `pod install`, build TestFlight de contrôle.
3. `apps/mobile/THIRD-PARTY-LICENSES.md` et « À propos › Crédits » listent les
   composants et leurs licences ; les sources et la recette sont publiques.
4. **Liaison statique — tranché** : le xcframework reste statique. La LGPL
   demande de pouvoir relier l'app avec une bibliothèque modifiée, pas une
   bibliothèque partagée ; le code complet de Tentacle TV est public (MIT) et
   chaque version soumise est taguée, donc reconstructible. Obligations :
   tag public, crédits et `THIRD-PARTY-LICENSES.md` à jour, variante LGPL dans
   le paquet soumis. TestFlight avec les binaires GPL du fork reste le chemin
   de test (décision de session).

## 6. Ouvert, non vérifié, à trancher

- **AV1 (iOS)** : les quatre AV1 10 bits de la bibliothèque tuent l'app dès
  « Opening decoder libdav1d » (SIGSEGV, saut à 0 dans le thread `core`, `lr`
  nul) — avec 1 ou 11 fils, `vd-lavc-dr=no`, grain de film CPU : le binaire du
  fork (dav1d construit **sans assembleur**) est en cause. Aucun AV1 8 bits pour
  départager. Décision prise : AV1 sans puce → lecteur système (le serveur
  convertit, raison `av1-software`) ; avec la puce (A17 Pro et plus), mpv lit
  l'AV1 en MKV. Hors ligne : pas d'original AV1 sur ces appareils. **À
  vérifier sur un appareil sans puce AV1** ; si ça ne plante pas, retirer la
  règle (`engineRouter.ts`, `keepTargets.ts`).
- **Sous-titres externes** (gardés dans leur format, ajoutés par `addSubtitle`
  `file://`) : aucune bibliothèque de test n'en a — chemin écrit, non exercé.
- **Appareil réel** (iPhone) : `hwdec-current=videotoolbox`, HDR/EDR
  (`wantsExtendedDynamicRangeContent`, iOS 17+), AirPlay réel vers « Chambre »,
  PiP mpv et natif, arrière-plan (audio continue, `vid=no`), composite OSD des
  sous-titres, `tls-verify` face au certificat du serveur https.
- **Tout Android** : react-native-video 6.19.3 + patch, Media3 1.9, décodeur
  FFmpeg de Jellyfin, minSdk 26, module Kotlin — la CI Android sera le premier
  compilateur.
- Le chien de garde « rien après 20 s » relance en **transcodage** : un premier
  chargement mpv lent (probe de 10 Mo, cache) peut déclencher une conversion
  serveur non voulue ; mesurer sur appareil, ajuster le délai pour mpv.
- Police de repli des sous-titres : Noto Sans (latin) ; le CJK dépend de
  CoreText (PingFang) — acceptable, non vérifié à l'écran.
- `stream-lavf-o` : la virgule de `reconnect_on_http_error=4xx,5xx` coupait la
  liste (corrigé au mobile par `-append`) ; **le bureau porte le même défaut**
  (`apps/web/src/hooks/mpvRuntime.ts`), hors périmètre de ce chantier.
- Entrées hors ligne `pmax` (remux) existantes : lecture inchangée par le code,
  non rejouée (aucune entrée sur le simulateur).

## 7. Outils de développement

- `__tentaclePlayer` (lecteur, en ligne et local) et `__tentacleOffline`
  (garder hors ligne, lister) : globaux `__DEV__`, pilotés par l'inspecteur
  Hermes de Metro (`/json/list` → CDP `Runtime.evaluate`).
- `TENTACLE_MPV_OPTS="nom=valeur;…"` (DEBUG) : options mpv d'initialisation
  supplémentaires ; au simulateur, `SIMCTL_CHILD_TENTACLE_MPV_OPTS`.
- Lien profond `tentacle://watch/<itemId>` ; relancer l'app entre deux cas (un
  lien empile un écran, l'ancien lecteur continue).
