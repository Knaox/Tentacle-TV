# Releases par tags — guide développeur

Chaque plateforme se publie en **poussant un tag git**. Un tag = une commande,
la CI (GitHub Actions, gratuite car repo public) build + signe + envoie.

## Nomenclature

```
<canal>-v<version>-<build>
```
- **version** = version marketing (`CFBundleShortVersionString` / `versionName`). Ex. `1.0.0`.
- **build**   = numéro de build (`CFBundleVersion` / `versionCode`). À **incrémenter** pour
  ré-uploader **la même version** sur TestFlight sans collision (Apple refuse 2× le même build).

### Le flux Apple (important)
- **Bump de version** (`app-v1.0.1-1`) → crée la **version** sur App Store Connect + 1er build,
  et remplit « Nouveautés ».
- **Bump de build seul** (`app-v1.0.0-2`, même version) → **nouveau build TestFlight** sous la
  version 1.0.0 existante (pour corriger/retester), sans toucher la version.

## Canaux

**Un tag = une plateforme.** Chaque plateforme a son préfixe dédié → on déploie l'une
sans toucher aux autres.

| Tag | Build | Destination | Workflow |
|-----|-------|-------------|----------|
| `mac-v…` | **macOS desktop** | App Store / TestFlight | `release-appstore.yml` ✅ |
| `ios-v…` | **iOS** | TestFlight | `release-ios.yml` ✅ |
| `apk-v…` | **Android mobile** | APK (GitHub Release, debug-signed) | `release-android.yml` ✅ |
| `tv-v…`  | **Android TV** | APK (GitHub Release + `tv-latest`) | `release-tv.yml` ✅ |
| `atv-v…` | **Apple TV (tvOS)** | TestFlight | `release-atv.yml` ✅ |
| `win-store-v…` | **Windows** | Microsoft Store (soumission + publication auto) | `release-store.yml` ✅ |
| `play-v…` / `play-internal-v…` | **Android mobile** | Google Play (alpha / interne, AAB signé) | `release-play.yml` ✅ |

> macOS + iOS partagent la même fiche App Store Connect `com.tentacle.mobile` mais se
> déploient séparément (`mac-v…` / `ios-v…`). iOS : projet natif versionné, build
> `xcodebuild` sans EAS, signature **automatique** via la clé API App Store Connect
> (aucun profil à fournir). Android mobile (`apk-v…`) reste **debug-signed** (sideload)
> tant que le keystore release Play Store n'est pas posé — voir le TODO en tête de
> `release-android.yml`.

## Exemples

```bash
# macOS — 1er build de la 1.0.0 sur TestFlight
git tag mac-v1.0.0-1 && git push origin mac-v1.0.0-1

# macOS — nouveau build TestFlight de la MÊME version 1.0.0 (correctif)
git tag mac-v1.0.0-2 && git push origin mac-v1.0.0-2

# macOS — nouvelle version 1.0.1 (crée la version + "Nouveautés")
git tag mac-v1.0.1-1 && git push origin mac-v1.0.1-1

# iOS — build 41 de la 1.2.2 sur TestFlight
git tag ios-v1.2.2-41 && git push origin ios-v1.2.2-41

# Android mobile — APK 1.2.2 build 1 (Release GitHub, sideload)
git tag apk-v1.2.2-1 && git push origin apk-v1.2.2-1

# Android TV — APK 1.0.0 build 7
git tag tv-v1.0.0-7 && git push origin tv-v1.0.0-7
```

Build macOS **sans tag** (test, depuis l'onglet Actions) :
`Actions → Release Mac App Store → Run workflow` (champs version / build / submit).

## Notes de version (FR + EN)

Édite **`CHANGELOG.md`** : un bloc **par canal** `## [<canal>-<version>]` avec `### FR` et
`### EN` — canaux : `mac`, `ios`, `atv`, `win`, `play` (ex. `## [ios-1.2.4]`,
`## [win-1.10.1]`). Chaque plateforme ayant sa propre numérotation, le préfixe évite les
collisions ; le bloc nu `## [x.y.z]` reste un repli (historique). Sans `### EN`, la section
FR sert aux deux langues. Le markdown (gras, liens, `code`, puces) est converti en texte
brut pour les stores.

| Canal | Store | Champ rempli | Limite |
|-------|-------|--------------|--------|
| `mac` / `ios` / `atv` | App Store + TestFlight | « Nouveautés » + « À tester » | 4000 car. |
| `win` | Microsoft Store | « Nouveautés de cette version » (fr-fr + en-us) | 1500 car. |
| `play` | Google Play | « Nouveautés » (fr-FR + en-US) | 500 car. |
| `mac` | Release GitHub | corps de la release (markdown brut) | — |

**Flux Apple « je clique juste Publier »** : après l'upload, la CI pose les notes
(`asc-release-notes.mjs`, non bloquant), puis un job séparé attend la fin du traitement du
build (~10-35 min) et le **rattache à la version App Store** avec « À tester »
(`asc-attach-build.mjs`, non bloquant). Il ne reste qu'à cliquer **« Soumettre pour
examen »** dans App Store Connect.

**Microsoft Store** : `msstore publish` a été remplacé par `msstore-submit.mjs` (API Store
Submission — clone de la dernière soumission publiée, notes FR/EN, remplacement du package,
publication automatique). `PARTNER_SELLER_ID` n'est plus utilisé.

**Google Play** : `release-play.yml` génère `whatsnew-fr-FR`/`whatsnew-en-US` depuis le bloc
`## [play-<expo.version>]` (rien n'est envoyé si le bloc n'existe pas).

Scripts : `.github/scripts/release-notes.mjs` (CLI d'extraction/formatage),
`asc-release-notes.mjs`, `asc-attach-build.mjs`, `msstore-submit.mjs`
(+ libs partagées `lib/changelog.mjs`, `lib/asc-api.mjs`).

## Pré-requis / assets de signature (secrets GitHub)

| Plateforme | Assets | Statut |
|-----------|--------|--------|
| macOS | Apple Distribution + Mac Installer Distribution + profil MAS | ✅ en place |
| iOS | Apple Distribution + clé API ASC (signature auto, profil géré par Apple) | ✅ en place |
| Apple TV | bundle id `com.tentacle.mobile` + signature auto (mêmes secrets) | ✅ en place — activer la plateforme tvOS sur la fiche ASC |
| Android (mobile/TV) | keystore release (sinon `debug.keystore` = sideload) | à fournir |
| Apple (commun) | `APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_CONTENT` | ✅ en place |

> macOS embarque libmpv/FFmpeg recompilés **LGPL** (sandbox App Store). Détails build :
> `apps/desktop/scripts/build-mpv-lgpl-macos.sh`. Voir aussi `docs/RELEASE.md` § 6b.
> Conformité chiffrement déclarée exemptée (`ITSAppUsesNonExemptEncryption=false`).
