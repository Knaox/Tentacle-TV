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

## 1 bis. TLS — les racines de confiance viennent avec l'app

Aucun des deux FFmpeg ne connaît le magasin de certificats du système :
libmpv-android est construit avec **mbedTLS** (3.6.6), MPVKit avec **GnuTLS**
compilé en croisé sans magasin par défaut (`--without-p11-kit`, pas de
`--with-default-trust-store-file` ; la détection automatique de GnuTLS ne
joue qu'en compilation native, jamais pour iOS). Avec `tls-verify=yes` — la
règle, comme `fetch` — et sans `tls-ca-file`, la vérification n'a AUCUNE
racine et refuse tout serveur https, valide ou non ; mpv échoue à l'ouverture
après les 4 tentatives de reconnexion de FFmpeg (~5 s).

Le paquet de racines Mozilla (extrait par curl, `https://curl.se/ca/cacert.pem`)
vit à **un seul endroit** : `apps/mobile/modules/mpv-player/ios/Resources/mpv/cacert.pem`.
CocoaPods ne lit rien hors du dossier du podspec, Gradle lit n'importe où :
le podspec le copie à la racine du bundle (`Bundle.main`, lu en place par
`setupTlsTrust`), `build.gradle` monte `../ios/Resources` en assets
(`mpv/cacert.pem`, copié dans `files/mpv/` par `installCaBundle`). Même
confiance que les lecteurs système : les autorités publiques, pas le magasin
de l'utilisateur — un certificat auto-signé ou une autorité privée ne passe
pas par le lecteur avancé (repli sur le lecteur système, qui lui suit le
magasin de l'appareil). Rafraîchir le paquet : remplacer le fichier, vérifier
l'en-tête « Certificate data from Mozilla as of ».

Pour les sous-requêtes HLS (playlists, segments), FFmpeg ne propage pas
`ca_file` ni `tls_verify` : elles partent avec `tls_verify=0` — seule la
playlist maître est vérifiée. Mesuré à l'émulateur : le palier transcodé se
lit en https (§4 bis).

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
| **https** (poulpy, Let's Encrypt, chaîne ECDSA P-384 en 4 certificats, TLS 1.3) : DirectPlay par `/jellyfin` (direct streaming) et par `/api/jellyfin` (proxy), puis palier 720p = HLS transcodé | mbedTLS 3.6.6 + paquet Mozilla : lu, ASS rendu, reprise exacte ; HLS : master, main et segments ouverts en https (§1 bis) |
| https SANS racines (mpv.conf `tls-ca-file=/data/nonexistent.pem`) — la situation de l'iPhone avant correctif | `mbedtls_x509_crt_parse_file … returned -15872`, 4 tentatives FFmpeg (0, 1, 3 s), échec remonté à JS en 5 s, **repli sur le lecteur système** (MKV lu par ExoPlayer) |

Non vérifié sur Android : `hwdec=mediacodec-copy` (appareil réel seulement),
PGS sur le lecteur système (Media3), la lecture 4K en logiciel (saccade
attendue à l'émulateur). Un délai
d'attente de 20 s sur la toute première ouverture de la tablette (Metro
construisait son bundle) n'a pas été reproduit.

Pièges mesurés : `stream-lavf-o-append` est refusé par
`mpv_set_option_string` (-5) — la virgule se protège par `%7%4xx,5xx` ; iOS
portait le même défaut (refus journalisé seulement), aligné le 21 septembre
2026 après vérification avec un mpv de bureau (FFmpeg retente sur un 400). `load-osd-console`
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

## 5 bis. Quitter le lecteur éteint tout (1.8.1)

Symptôme rapporté : après avoir quitté une lecture, un passage sur une
notification faisait réapparaître l'habillage du lecteur mpv ; iOS croyait
l'app encore en lecture en arrière-plan. Le moteur ne s'éteignait qu'au
`deinit` de sa vue, et son démontage laissait trois choses derrière lui :

- la session audio était désactivée AVANT que mpv ait fini de s'arrêter (sa
  destruction est asynchrone) : iOS refuse de désactiver une session dont une
  sortie tourne (`isBusy`), et le `try?` avalait l'échec ;
- les commandes de l'écran verrouillé perdaient leurs cibles mais restaient
  ACTIVES — le lecteur (±15 s) survivait à la fermeture ;
- le singleton Now Playing, sans propriétaire, était effacé par le lecteur
  SORTANT quand l'épisode suivant venait de le publier.

Désormais : `release()` (vue native, iOS et Android) est appelé par JS AVANT
de fermer l'écran (`leavePlayer`, épisode suivant/précédent, notification
tapée en pleine lecture — `src/player/openPlayer.ts`) ; la session audio est
rendue par le DERNIER moteur vivant, une fois mpv détruit, avec trois relances
sur `isBusy` ; les commandes s'éteignent ; Now Playing a un propriétaire ;
l'image dans l'image automatique se désarme dès que la vue quitte la fenêtre ;
et une vue retirée de l'arbre sans `release` s'éteint d'elle-même après une
seconde (hors image dans l'image). Vérifié au simulateur (journal natif :
`moteur démonté` puis `session audio rendue`, par Retour comme par une
notification tapée en lecture). L'image dans l'image elle-même n'existe pas au
simulateur : à confirmer sur iPhone.

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
  sous-titres, et **https** : jusqu'au 21 septembre 2026, iOS posait
  `tls-verify=yes` sans aucun fichier de racines (§1 bis) — tout serveur https
  était refusé par mpv, valide ou non. Le correctif (`setupTlsTrust`) est écrit
  sans compilateur Swift sous la main : à confirmer au simulateur ou sur
  iPhone face à `https://poulpy.rouge-informatique.ch` (journal mpv : aucun
  « Peer certificate failed verification », lecture directe sans repli).
- **Android sur appareil réel** : `hwdec=mediacodec-copy`, taille de l'AAB par
  ABI. Le reste — https compris — est vérifié à l'émulateur (§4 bis). Image
  dans l'image et MediaSession (`nowPlaying`) restent hors périmètre sur
  Android.
- Le chien de garde « rien après 20 s » relance en **transcodage** : un premier
  chargement mpv lent (probe de 10 Mo, cache) peut déclencher une conversion
  serveur non voulue ; mesurer sur appareil, ajuster le délai pour mpv.
- Police de repli des sous-titres : Noto Sans (latin) ; le CJK dépend de
  CoreText (PingFang) — acceptable, non vérifié à l'écran.
- `stream-lavf-o` : la virgule de `reconnect_on_http_error=4xx,5xx` coupait la
  liste (corrigé au mobile, iOS et Android, par la forme `%7%`) ; **le bureau
  porte le même défaut** (`apps/web/src/hooks/mpvRuntime.ts`), hors périmètre
  de ce chantier.
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
