# Licences — Tentacle TV et ce qu'il embarque

> Inventaire du 2026-10-07 (audit `licences/agpl-audit`). Pas un avis juridique :
> les points marqués **⚖️ juriste** demandent une relecture par un professionnel.
> Source unique de ce que montrent les applications : `packages/shared/src/licenses/`
> (catalogue par plateforme + textes complets). Détail par application :
> `apps/*/THIRD-PARTY-LICENSES.md`.

## 1. La licence de Tentacle TV

- **AGPL-3.0-or-later** depuis le 2026-10-07 (`LICENSE`, texte officiel de la FSF).
  Toute copie modifiée — distribuée OU offerte comme service en ligne (§13) — doit
  publier son code source complet sous la même licence.
- **Permissions et termes additionnels** (AGPL §7, `LICENSE-EXCEPTIONS`, en anglais) :
  1. distribution par les **boutiques d'applications** (App Store, Mac App Store,
     Google Play, Microsoft Store, LG Content Store) malgré leurs conditions, à
     condition que la source soit publique, gratuite, et désignée dans l'app ou sa fiche ;
  2. liaison avec les **bibliothèques de plateforme non libres** (Firebase / Play
     services, frameworks d'Apple, bibliothèques de webOS) — pour le seul code de Tentacle ;
  3. **terme de marque** (§7 e) : le nom et le logo ne sont pas concédés → `TRADEMARK.md`.
- **« -or-later »** plutôt que « -only » : Damien est seul titulaire (voir §6), il garde
  la main sur les versions futures de toute façon ; « or later » est la recommandation de
  la FSF, la forme de Mastodon et de Nextcloud, et laisse combiner du code tiers
  « GPL-3.0-or-later » ou une future AGPL sans relicencier. Les composants MPL-2.0
  (Streamyfin) le permettent (MPL §3.3, « Secondary License »).
- **Les versions publiées avant le 2026-10-07 restent MIT, pour toujours** (desktop
  ≤ 1.26.0, mobile ≤ 1.10.2, tv ≤ 1.10.0, server ≤ 1.23.0, webos 1.0.0, et tout commit
  antérieur). Une licence accordée ne se reprend pas ; le changement vaut pour la suite.
- **Mention dans chaque app** (AGPL §5 et « Appropriate Legal Notices ») : écran
  « Licences » — copyright, absence de garantie, licence, lien vers la source AU TAG de
  la version (`<plateforme>-vX.Y.Z`), et les textes complets hors ligne.

## 2. Inventaire par plateforme

Légende : ✅ conforme · 🛠 corrigé sur cette branche · ⚠️ non conforme, reste à faire.

### iPhone (App Store) — `apps/mobile`

| Composant | Licence | État |
|---|---|---|
| MPVKit (lecteur avancé) — **livré en 1.10.x : binaires GPL du fork Streamyfin** (mpv `-Dgpl=true`, libsmbclient GPL-3, FFmpeg `--enable-nonfree` « nonfree and unredistributable », archive statique) | GPL-3 + nonfree | 🛠 variante LGPL construite par `mpvkit.yml` (mpv `-Dgpl=false`, FFmpeg LGPL v3+, sans Samba ni LuaJIT, sans `--enable-nonfree`) ; garde `mobile.yml` qui refuse un podspec GPL au cran test/store ; **⚠️ Release CI à produire** (voir §7) |
| Dépendances de MPVKit (libplacebo, GnuTLS, Nettle, GMP, FriBidi, libbluray, uchardet, libass, FreeType, HarfBuzz, lcms2, dav1d, uavs3d, libdovi, MoltenVK, shaderc, OpenSSL…) | LGPL / permissives | 🛠 listées avec mentions (crédit FreeType) dans l'écran Licences |
| Module `mpv-player` (dérivé de Streamyfin) | MPL-2.0 | ✅ en-têtes ; ⚠️ 5 fichiers propres sans en-tête, podspec `MpvPlayer` en « MPL-2.0 » seul |
| React Native, Expo, Hermes, folly, boost, glog, SDWebImage, libwebp, libavif… | MIT / Apache / BSL / BSD | 🛠 listés |
| Inter, Noto Sans | OFL-1.1 | 🛠 texte OFL dans l'app |
| Feather, Lucide | MIT / ISC | 🛠 listés |

Liaison statique LGPL : tenue par la publication du code de l'application à chaque tag
livré (« Corresponding Application Code », LGPL-3 §4 d 0) — on peut relier un MPVKit
modifié. **⚖️ juriste** : la lecture « App Store + LGPL en statique + source publique »
est celle de VLC, de Streamyfin et d'Infuse ; elle n'a pas été tranchée par un tribunal.

### Android (Google Play) — `apps/mobile`

| Composant | Licence | État |
|---|---|---|
| libmpv-android 1.0.0 (mpv GPL-2+, FFmpeg n8.1 `--enable-gpl --enable-version3`) — le POM dit « MIT » : licence des scripts | **GPL-3.0-or-later** | ✅ compatible AGPL (§13) ; 🛠 texte GPL-3 et source dans l'app |
| Décodeur FFmpeg de Jellyfin pour Media3 1.9.0+1 | GPL-3.0 | idem |
| **Firebase Messaging + Play services** (propriétaires) dans le MÊME APK que le GPL | propriétaire | **⚠️ risque** : la GPL de mpv / FFmpeg n'autorise pas la combinaison avec une bibliothèque non libre embarquée (pas une « System Library »). Damien ne peut excepter que son propre code (fait : `LICENSE-EXCEPTIONS` §2). **⚖️ juriste.** Correctif propre : libmpv-android reconstruit en LGPL + `decoder_ffmpeg` d'androidx (LGPL/Apache) — voir §7 |
| Media3 / ExoPlayer, Fresco, React Native, Expo | Apache / MIT | 🛠 listés |

### Apple TV (App Store) — `apps/tv`

| Composant | Licence | État |
|---|---|---|
| PrismCore 3.2.2 modifié (`apps/tv/ios/Vendor/PrismCore`) | LGPL-2.1+ avec exception App Store | **⚠️ → 🛠** l'exception exige « une copie de cette Licence » dans l'app : elle manquait (simple renvoi). L'onglet Licences l'embarque désormais en entier |
| MPVKit 1.0.0 amont (produit `MPVKit`, non GPL) : FFmpeg n8.1.2 **LGPL v3+**, GnuTLS, GMP, Nettle, libplacebo, FriBidi, dav1d, uavs3d, libass, FreeType, HarfBuzz, lcms2, shaderc, MoltenVK, OpenSSL, libdovi | LGPL / permissives | ✅ aucun GPL dans le binaire (vérifié sur le build Release du 03/10) ; 🛠 l'app disait « LGPL v2.1+ liées dynamiquement » : c'est LGPL v3+, **liées statiquement** (les `Frameworks/*.framework` sont des bouchons vides) |
| react-native-tvos, Hermes, Inter, Lucide (tracés recopiés dans `iconPaths.ts`) | MIT / OFL / ISC | 🛠 listés |

### Android TV (Google Play) — `apps/tv`

libmpv-android 1.0.0 et le décodeur de Jellyfin 1.8.0+1 (GPL-3), Media3 1.8.0, sans
aucun composant propriétaire (pas de Firebase) : combinaison licite. 🛠 textes et
source dans l'onglet Licences. `DvCompatRenderer.kt` cite « JellyDV / VoidTV »
(VoidTV : GPL-3.0) : aucun fichier équivalent dans VoidTV, technique et non copie ;
de toute façon compatible AGPL.

### Bureau — `apps/desktop-electron`

| Canal | libmpv livrée | Licence effective | État |
|---|---|---|---|
| Mac App Store | build maison `build-mpv-lgpl-macos.sh` : mpv 0.40.0 `-Dgpl=false`, FFmpeg 7.1.1, dylibs séparées | LGPL-2.1+ | ✅ vérifié dans l'app installée (« libavutil license: LGPL version 2.1 or later ») ; ⚠️ `LICENSE` d'Electron et `LICENSES.chromium.html` absents du `.app` (posés à côté puis non emballés) |
| Microsoft Store | **DLL tierce commitée** `lib/mpv/libmpv-2.dll` (zhongfly/mpv-winbuild, variante LGPL, mpv master 0.41.0-233, FFmpeg 8 `--enable-version3` + OpenSSL, statique) | LGPL-3.0+ | ⚠️ **source introuvable** (builds purgés après 30 jours, commit non reproductible) ; 🛠 l'app disait « LGPL v2.1+ » |
| Linux (GitHub) | build maison `build-mpv-linux.sh` : mpv 0.41.0 `-Dgpl=true` (X11), FFmpeg 7.1.1 LGPL statique | GPL-2.0+ (→ GPL-3 combinée) | ✅ compatible AGPL ; ⚠️ aucune source jointe aux Releases |

Electron 43.2.0 (MIT) + Chromium (`LICENSES.chromium.html`), koffi 3.1.2 (MIT ; koffi
1.x était AGPL — ne pas rétrograder). La variable `TENTACLE_MPV_LIB` charge une libmpv
modifiée : c'est le « relier » de la LGPL, désormais dit dans l'app.

### Serveur — image Docker `ghcr.io/knaox/tentacle-tv`

| Composant | Licence | État |
|---|---|---|
| Dépendances npm de production (137 paquets dans l'image) | MIT, ISC, BlueOak, BSD-3, Apache-2.0 | ✅ aucune GPL/LGPL/AGPL/inconnue ; 🛠 l'élagage effaçait les `LICENSE.md` de 13 paquets |
| `ffmpeg` 8.1.2 (programme) | LGPL-2.1+ | ✅ |
| `fpcalc` (Chromaprint 1.6.0) lié **statiquement à FFTW3** | **GPL-2.0+** (et non LGPL comme le disait le Dockerfile) | ✅ programme séparé, aucun lien avec Tentacle ; ⚠️ offre de sources |
| yt-dlp 2026.08.19 (zipapp, pas PyInstaller), Python 3.14 | Unlicense / PSF-2.0 | ✅ |
| Alpine (busybox, apk-tools… **GPL-2.0-only**), Node.js | GPL / MIT | ✅ programmes séparés ; ⚠️ LICENSE de Node absent, offre de sources |
| **Image v1.23.0 déjà publiée** : ffmpeg d'Alpine `--enable-gpl --enable-version3` + x264/x265 | GPL-3.0+ | ⚠️ offre de sources à couvrir pour les images déjà distribuées |
| Client web servi (React, hls.js Apache-2.0, framer-motion, lucide, Heroicons, Inter…) | MIT / Apache / ISC / OFL | 🛠 écran Licences ; ⚠️ pas de fichier de notices généré au build |

Ce qui tourne en programme séparé (`execFile`) n'est pas une œuvre dérivée du serveur
(agrégat, AGPL §5) : aucune contamination, mais l'obligation de fournir les sources des
binaires GPL distribués DANS l'image demeure.

### Client LG (webOS)

L'IPK ne contient que la coquille, notre code et nos images : ✅. Le client est servi
par le serveur sous `/tv` (licences : celles du client web). `webOSTV.js` (SDK LG) n'est
pas versionné ; s'il entrait dans l'IPK, vérifier sa licence. 🛠 la page Crédits du
client LG porte l'écran Licences ; ⚠️ rien n'y mène encore depuis « À propos » sur la TV.

### Polices et icônes

Inter (OFL-1.1, web/bureau/LG par `@fontsource-variable/inter`, mobile v3.019, TV v4.001),
Noto Sans (OFL-1.1, repli libass iOS), Feather (MIT, mobile), Lucide (ISC + Feather MIT,
partout), Heroicons (MIT, tracés recopiés dans 13 fichiers web), country-flag-icons (MIT).
🛠 tous dans le catalogue, texte OFL embarqué. « DM Sans » n'est que nommée, jamais
chargée. ⚠️ Les iframes d'extensions chargent Inter depuis fonts.gstatic.com (fuite d'IP
vers Google, RGPD) — servir les woff2 locaux.

## 3. Compatibilité avec l'AGPL-3.0 — les composants à risque

| Risque | Composants | Verdict |
|---|---|---|
| GPL-2.0-**only** lié au code de Tentacle | **aucun** trouvé | — |
| GPL-2.0-only dans l'image, non lié | busybox, apk-tools, alpine-baselayout, scanelf | ✅ programmes séparés |
| GPL-2.0-or-later / GPL-3.0 liés | mpv (Linux, Android), FFmpeg Android, décodeur Jellyfin, FFTW (fpcalc) | ✅ AGPL-3 §13 / GPL-3 §13 permettent la combinaison |
| Multi-licences dont une GPL-2.0 | mbedTLS (Apache-2.0 OR GPL-2.0+), FreeType (FTL OR GPL-2.0+), GMP/Nettle (LGPL-3 OR GPL-2+), uchardet, graphite2, node-forge | ✅ on choisit l'option permissive / LGPL |
| LGPL-2.1 / LGPL-3 | FFmpeg, mpv (LGPL), libplacebo, GnuTLS, PrismCore… | ✅ compatibles |
| Apache-2.0 | Media3, MoltenVK, OpenSSL 3, Prisma, hls.js, folly | ✅ compatible GPL-3/AGPL-3 (pas GPL-2 : sans objet ici) |
| MPL-2.0 | Streamyfin (module mpv-player), cacert.pem | ✅ fichiers restés MPL, sans clause « Incompatible With Secondary Licenses » |
| **Propriétaire** | Firebase / Play services (mobile Android) | ⚠️ voir Android ci-dessus |

## 4. Les extensions (plugins) et Vigie

Les extensions serveur sont importées DANS le processus du serveur
(`pluginBackendLoader.ts`) avec l'API `packages/plugins-api` : selon la lecture de la
FSF, extension + serveur forment une œuvre combinée. **Décision : pas d'exception
« extensions »** — c'est le but même du passage à l'AGPL (pas de clone fermé). Une
extension tierce doit donc être sous une licence COMPATIBLE avec l'AGPL : MIT, Apache-2.0,
BSD, GPL-3, AGPL-3… — seules les extensions propriétaires sont exclues.

**Vigie** (dépôt Tentacle-Plugin-Seer) est public **sans aucune licence**, donc « tous
droits réservés » par défaut. Damien en étant l'auteur, rien n'est enfreint ; mais pour
la cohérence et pour que des tiers puissent le redistribuer avec le serveur, **proposition :
le passer en AGPL-3.0-or-later** (même `LICENSE-EXCEPTIONS` si une partie tourne dans les
apps des boutiques). Rien n'a été modifié dans ce dépôt.

## 5. Jellyfin

Revérifié : aucun code, logo, asset ni couleur de Jellyfin embarqué ; « Jellyfin »
n'apparaît dans aucun nom d'app, d'image ou de paquet. Les mentions sont nominatives
(compatibilité, page Crédits, avis de non-affiliation du README et de `TRADEMARK.md`).
33 commentaires « jellyfin-web pattern » décrivent des comportements réécrits ; jellyfin-web
est GPL-2.0-or-later, donc compatible AGPL même en cas d'emprunt réel. Le décodeur FFmpeg
« Jellyfin Media3 » (GPL-3) est une bibliothèque tierce citée sous son nom.

## 6. Auteurs

`git log --all` : Knaox (deux adresses), Knaox_, Damien ROUGE, tentacle-bot (la CI) —
tous Damien. Aucune autre PR fusionnée (2 PR, toutes deux de Knaox). Les traits
« Co-Authored-By: Claude » désignent un outil, pas un titulaire de droits. **Damien est
seul titulaire** : il pouvait relicencier. Les contributions futures sont reçues sous les
mêmes termes (README › Contributing) — **⚖️ juriste** : un CLA ou un DCO explicite
protégerait mieux la faculté d'accorder les permissions de `LICENSE-EXCEPTIONS`.

## 7. Restes

1. **iOS** : publier la Release `mpvkit-lgpl-0.41.0-av5` — le `mpvkit.yml` de `main` ne
   peut pas réussir (garde déclenchée À RAISON par libsmbclient / LuaJIT emballés) :
   fusionner les commits `mpvkit.yml` de cette branche sur `main`, relancer, reporter
   URL + sha256 + `license` dans `apps/mobile/ios/MPVKit.podspec`. La garde de
   `mobile.yml` bloque iOS au cran test/store jusque-là.
2. **Android** : libmpv-android en LGPL (mpv `-Dgpl=false`, FFmpeg sans `--enable-gpl`,
   `--enable-version3` pour mbedTLS) + `decoder_ffmpeg` construit depuis androidx/media,
   publiés par une Release du dépôt — sinon le GPL côtoie Firebase dans l'APK.
3. **Windows** : construire `libmpv-2.dll` soi-même à tags épinglés, ou archiver la
   source exacte ; tant que ce n'est pas fait, la LGPL n'est pas tenue (source introuvable).
4. **Sources** : à chaque Release (`desktop-v*`, `server-v*`, `mobile-v*`, `tv-v*`), une
   archive des sources des composants (L)GPL embarqués + manifeste des versions (Homebrew,
   apt, Alpine). Y compris pour les images serveur et les apps déjà publiées.
5. **Mac App Store** : poser `LICENSE` d'Electron et `LICENSES.chromium.html` dans
   `Contents/Resources` avant la signature (`package-macos.mjs`).
6. **Boutiques** : CLUF personnalisé (App Store Connect, Partner Center) qui réserve les
   droits des composants LGPL/GPL (modification, rétro-ingénierie pour le débogage) ;
   fiches : « AGPL-3.0 » + URL de la source.
7. **Notices générées** : `rollup-plugin-license` (web, LG), acknowledgements CocoaPods /
   SwiftPM, rapport Gradle — pour les centaines de paquets MIT/BSD dont l'écran ne liste
   que les principaux.
8. **Dépôt** : retirer la mpv Homebrew GPL commitée `apps/desktop-electron/lib/mpv/libmpv.dylib`
   et les `libmpv-wrapper.*` (jamais chargés, distribués sans source).
9. **Image** : retirer npm / corepack / yarn de l'étape finale ; figer `fftw-static` et
   l'URL de `tailwind.js` ; servir Inter en local aux iframes.
