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
| *(manuel)* | **Windows** | Microsoft Store | `release-store.yml` |

> macOS + iOS partagent la même fiche App Store Connect `com.tentacle.mobile` mais se
> déploient séparément (`mac-v…` / `ios-v…`). iOS : projet natif versionné, build
> `xcodebuild` sans EAS, signature **automatique** via la clé API App Store Connect
> (aucun profil à fournir). Android mobile (`apk-v…`) reste **debug-signed** (sideload)
> tant que le keystore release Play Store n'est pas posé — voir le TODO en tête de
> `release-android.yml`.
>
> 🛠️ **Astuce** : l'outil `tools/deploy/tentacle-deploy.html` (copie sur le Bureau)
> génère le bon tag et la commande `git tag … && git push …` — pas besoin de retenir les préfixes.

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

Édite **`CHANGELOG.md`** : un bloc `## [x.y.z]` avec `### FR` et `### EN`. La CI extrait ces
sections et remplit, via l'API App Store Connect :
- **« Nouveautés de cette version »** (App Store) — `appStoreVersionLocalizations.whatsNew`.
- **« À tester »** (TestFlight) — `betaBuildLocalizations.whatsToTest` (dès que le build est
  traité par Apple ; sinon à définir au prochain passage).

Sans section `### EN`, la section FR est utilisée pour les deux langues. Script :
`.github/scripts/asc-release-notes.mjs` (non bloquant).

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
