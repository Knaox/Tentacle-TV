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
| Android | ExoPlayer/Media3 via react-native-video (+ extension FFmpeg de Jellyfin) | libmpv par **libmpv-android** 1.0.0 (`vo=gpu-next,gpu`, `gpu-context=android`, `hwdec=mediacodec-copy` — `no` à l'émulateur —, `ao=audiotrack,opensles`, `profile=fast`) — **vérifié à l'émulateur, §4 bis** |

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
défaut ; un repli (échec de lecture) impose ensuite l'autre moteur pour la
session. AirPlay est réactif dans les deux sens : actif, le lecteur système
l'emporte sur tout ; éteint, le lecteur avancé reprend à la même seconde (une
négociation par bascule ; la décision de retour juge les pistes par défaut,
comme au départ).

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
   h264 copié, aac, à 501 s) ; AirPlay éteint, retour à mpv à la même position.
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
l'éditeur de liens retient) ; **IPA release construit par la CI (1.8.0, build
1431115, TestFlight) : 35,4 Mo**. Android : ~24 Mo par ABI (libmpv) + 1,4 Mo
(décodeur FFmpeg), **non mesuré sur une build**.

Spécificités du simulateur : `hwdec=no`, `avfoundation-composite-osd=no` (les
sous-titres y sont dessinés grands, dans une couche séparée — artefact du
simulateur), PiP « non pris en charge », pas d'AirPlay.

## 4 bis. Vérifié sur Android (émulateurs Pixel 9 et Pixel Tablet, Android 16, x86_64)

Chantier du 21 septembre 2026. Le module Kotlin, écrit sans compilateur, a
demandé : le NDK 29 pour l'app (le libc++ du 27 n'a pas le `std::from_chars`
flottant que `libmpv.so` importe — « cannot locate symbol » au premier
`create`), les noms du délégué (`onLoad`/`onVideoParams` s'appelaient
eux-mêmes), des charges sans `null`, START_FILE pour ne plus prendre l'END_FILE
de l'ancien fichier pour un échec, le cycle de vie de la surface selon
mpv-android (`vo=null` quand elle meurt, `vo=gpu-next,gpu` quand elle renaît),
`destroy()` au démontage, et une seule `AudioFocusRequest` par vue.

Preuve = `GET /Sessions` (`PlayMethod`, `TranscodingInfo`), `adb logcat`
(le JNI de libmpv-android journalise TOUT en verbeux sous le tag `mpv`),
captures, et le crochet `__tentaclePlayer` piloté par `scripts/dev-hook.mjs`.

| Cas | Résultat |
|---|---|
| FLV h264 + ADPCM (conteneur hors ExoPlayer) | mpv ; audio transcodé par le serveur (`adpcm_swf` hors profil), vidéo copiée |
| MKV h264 + ASS (One Piece), téléphone ET tablette | DirectPlay, mpv, ASS rendu par libass avec ses styles ; rotation paysage ↔ portrait suivie (`android-surface-size`) |
| MKV HEVC 10 bits + ASS (My Hero Academia) | DirectPlay, mpv logiciel (`hwdec=no` à l'émulateur), 0 image perdue, sous-titre changé dans le moteur (`sid`), index remonté à Jellyfin |
| MKV AV1 10 bits (Du mouvement de la Terre) | DirectPlay, mpv (dav1d), `yuv420p10` |
| MKV h264 + DTS + PGS (L'attaque des Titans), auto | lecteur système, `FfmpegAudioRenderer` chargé, piste audio active — DirectPlay une fois le plafond automatique désarmé (« Originale ») ; avant, `ContainerBitrateExceedsLimit` : liste fermée, cas 1 |
| Hors ligne : MKV HEVC 10 bits original gardé, puis lu | `LocalPlayerScreen` → mpv sur le chemin décodé, aucune session serveur |
| AirPlay simulé (`simulateAirPlay`) : mpv → système → mpv | natif à 188 s (relance transcodée : pas de HEVC 10 bits à l'émulateur), **retour mpv à 204 s en lecture directe** |
| Accueil / retour, verrouillage / déverrouillage | `pause=true` → `VO: [null]` ; au retour `VO: [gpu-next]` puis `pause=false` (JS non prévenu, sa prop reste la vérité) |
| Appel entrant (`adb emu gsm call`) | `AUDIOFOCUS_LOSS_TRANSIENT` → pause, annoncée à JS ; pas de reprise automatique |
| Retour ×5 (`OnViewDestroys` → `destroy()`) | tas natif 551 → 313 Mo, 78 → 63 threads, aucun plantage |
| Réglages › Lecture | section « Lecteur vidéo » présente (moteur, sous-titres stylés, taille, position) |

Non vérifié sur Android : `hwdec=mediacodec-copy` (appareil réel seulement),
TLS (`tls-ca-file` posé, banc en http), PGS sur le lecteur système (Media3),
la lecture 4K en logiciel (saccade attendue à l'émulateur). Un délai
d'attente de 20 s sur la toute première ouverture de la tablette (Metro
construisait son bundle) n'a pas été reproduit.

Pièges mesurés : `stream-lavf-o-append` est refusé par
`mpv_set_option_string` (-5) — la virgule se protège par `%7%4xx,5xx` ; le
même défaut existe sur iOS, où le refus n'est pas journalisé. `load-osd-console`
s'appelle `load-console`. Le JNI demande le niveau « v » sans condition, release
compris : logcat reçoit tout, on n'y redouble que warn+. Le libc++ paqueté est
celui du NDK de l'app, pas celui de l'AAR.

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

- **Rejet silencieux au traitement App Store Connect (vécu deux fois, builds
  1431115 et 1431202)** : « UPLOAD SUCCEEDED », puis le build n'apparaît
  jamais — ni en traitement, ni invalide (voir la cible `asc-status` de
  `mobile.yml`). Cause : le module de capture `avfoundation` de libavdevice
  (FFmpeg, lié par mpv) référence `AVCaptureSession`, `AVCaptureDeviceInput`
  et les types caméra/micro ; sans `NSCameraUsageDescription` ni
  `NSMicrophoneUsageDescription`, Apple rejette (ITMS-90683). Les deux chaînes
  sont posées (Info.plist et app.json), avec la vérité : la caméra et le
  micro ne servent jamais. Mieux, pour la variante LGPL : construire MPVKit
  **sans libavdevice** (`mpvkit.yml`), et retirer les chaînes.

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
- **Android sur appareil réel** : `hwdec=mediacodec-copy`, TLS face à un
  serveur https (le paquet Mozilla est en place), taille de l'AAB par ABI. Le
  reste est vérifié à l'émulateur (§4 bis). Image dans l'image et MediaSession
  (`nowPlaying`) restent hors périmètre sur Android.
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

- `__tentaclePlayer` (lecteur, en ligne et local : moteur, pistes, saut,
  pause, `simulateAirPlay`, `changeQuality`, `technicalInfo`) et
  `__tentacleOffline` (garder hors ligne, lister) : globaux `__DEV__`, pilotés
  par `node scripts/dev-hook.mjs '<expression>'` (inspecteur Hermes de Metro ;
  `--device gphone|tablet` avec deux émulateurs ; une promesse rendue est
  attendue).
- Android : `adb shell run-as com.tentacletv.mobile sh -c 'cat > files/mpv/mpv.conf'`
  surcharge les options mpv (chargé à l'init) ; `adb logcat -s mpv` montre le
  journal complet ; `ANDROID_SERIAL=emulator-5556` cible la tablette.
- `TENTACLE_MPV_OPTS="nom=valeur;…"` (DEBUG) : options mpv d'initialisation
  supplémentaires ; au simulateur, `SIMCTL_CHILD_TENTACLE_MPV_OPTS`.
- Lien profond `tentacle://watch/<itemId>` ; relancer l'app entre deux cas (un
  lien empile un écran, l'ancien lecteur continue).
