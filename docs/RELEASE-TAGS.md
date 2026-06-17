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

| Tag | Build | Destination | Workflow |
|-----|-------|-------------|----------|
| `app-v…` | **macOS desktop** | App Store / TestFlight | `release-appstore.yml` ✅ |
| `app-v…` | **iOS** | TestFlight | *(à venir — asset requis)* |
| `app-v…` | **Android mobile** | APK | *(à venir — keystore requis)* |
| `tv-v…`  | **Android TV** | APK (GitHub Release) | `release-tv.yml` ✅ |
| `tv-v…`  | **Apple TV (tvOS)** | TestFlight | *(à venir — config tvOS)* |
| *(manuel)* | **Windows** | Microsoft Store | `release-store.yml` |

## Exemples

```bash
# macOS — 1er build de la 1.0.0 sur TestFlight
git tag app-v1.0.0-1 && git push origin app-v1.0.0-1

# macOS — nouveau build TestFlight de la MÊME version 1.0.0 (correctif)
git tag app-v1.0.0-2 && git push origin app-v1.0.0-2

# macOS — nouvelle version 1.0.1 (crée la version + "Nouveautés")
git tag app-v1.0.1-1 && git push origin app-v1.0.1-1

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
| iOS | profil App Store iOS (`com.tentacle.mobile`) | à fournir |
| Apple TV | bundle id + App ID + profil tvOS + app finalisée | à fournir/configurer |
| Android (mobile/TV) | keystore release (sinon `debug.keystore` = sideload) | à fournir |
| Apple (commun) | `APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_CONTENT` | ✅ en place |

> macOS embarque libmpv/FFmpeg recompilés **LGPL** (sandbox App Store). Détails build :
> `apps/desktop/scripts/build-mpv-lgpl-macos.sh`. Voir aussi `docs/RELEASE.md` § 6b.
> Conformité chiffrement déclarée exemptée (`ITSAppUsesNonExemptEncryption=false`).
