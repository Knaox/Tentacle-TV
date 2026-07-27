# Tentacle TV — Guide de Release

> **Vue d'ensemble à jour : `docs/RELEASE-TAGS.md`** (source unique `versions.json`,
> 3 workflows plateforme, builds auto-incrémentés). Ce guide couvre les détails
> par plateforme (secrets, signature, spécificités stores).

## Prérequis

- Node.js >= 20
- pnpm >= 10
- Rust stable + Tauri CLI (`pnpm add -Dg @tauri-apps/cli`) — macOS et Linux
  uniquement. Windows sort d’Electron et n’en a plus besoin.

## 1. Préparer une release

### Mettre à jour la version — UN SEUL fichier : `versions.json` (racine)

```json
{ "desktop": "1.12.0", "tv": "1.0.0", "mobile": "1.2.2", "server": "1.3.0" }
```

- Le champ de la plateforme est la **source unique** : la CI injecte cette version
  dans tous les artefacts (tauri.conf, Info.plist, versionName…).
- Les numéros de build (CFBundleVersion / versionCode) sont **auto-incrémentés**
  par la CI — plus rien à gérer.
- Optionnel (builds desktop locaux) : garder `apps/desktop/src-tauri/tauri.conf.json`,
  `Cargo.toml`, `apps/desktop/package.json` et
  `apps/desktop-electron/package.json` alignés sur `versions.json → desktop`.
  La CI, elle, injecte la version dans le paquet Electron avant l’empaquetage.
- Remplir `changelogs/<plateforme>.md` (bloc `## [X.Y.Z]`, `### FR`/`### EN`).

### Commit et tag

```bash
git add versions.json changelogs/
git commit -m "release(desktop): v1.12.0"
git tag desktop-v1.12.0
git push origin main desktop-v1.12.0
```

Le fichier `Tentacle Deploy.html` (hors repo) génère cette commande.

## 2. Workflows

| Déclencheur | Workflow | Cibles |
|-------------|----------|--------|
| tag `desktop-vX.Y.Z` | `desktop.yml` | macOS App Store + Microsoft Store + Linux (Release GitHub) |
| tag `tv-vX.Y.Z` | `tv.yml` | Android TV (Play Console UNIQUEMENT, test fermé « Alpha ») + Apple TV (TestFlight) |
| push `main` | `server.yml` | Image Docker (`:latest` + `:v<server>`) + Release GitHub si la version server change |
| tag `mobile-vX.Y.Z` | `mobile.yml` | iOS (TestFlight) + Android (Play Console, test fermé « alpha ») |

> L'ancien découpage (mac-v*/atv-v*/win-store-v*/linux-v* + docker.yml) a été
> fusionné dans ces workflows. Le DMG macOS notarisé (tag `v*`) reste retiré :
> macOS passe exclusivement par le Mac App Store.

## 3. Secrets GitHub

**GitHub → Settings → Secrets and variables → Actions.**

| Domaine | Secrets |
|---------|---------|
| Apple (commun mac/ios/tvOS) | `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_CONTENT`, `APPLE_DISTRIBUTION_CERT_BASE64`, `APPLE_DISTRIBUTION_CERT_PASSWORD` |
| Mac App Store | `MAC_INSTALLER_CERT_BASE64`, `MAC_INSTALLER_CERT_PASSWORD`, `MAS_PROVISIONING_PROFILE_BASE64` |
| Apple TV | `TVOS_PROVISIONING_PROFILE_BASE64` (profil App Store tvOS — signature manuelle) |
| Microsoft Store | `PARTNER_TENANT_ID`, `PARTNER_CLIENT_ID`, `PARTNER_CLIENT_SECRET` (Store ID `9NKHL0T84245`) |
| Android (Play, mobile + TV) | `MOBILE_KEYSTORE_BASE64`, `MOBILE_KEYSTORE_PASSWORD`, `MOBILE_KEY_ALIAS`, `MOBILE_KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON` |

## 4. Mises à jour automatiques (desktop)

Le mécanisme réel est le manifeste **`updates/store-versions.json`** (lu par l'app via
raw.githubusercontent.com, `apps/web/src/lib/storeVersions.ts`) :

- **macOS** : compare `macAppStore.version` → ouvre l'App Store. *(bloc édité à la main)*
- **Windows** : WinRT `check_msix_update` + `microsoftStore.version`. *(bloc édité à la main)*
- **Linux** : compare `linux.version`, télécharge l'asset de la Release GitHub
  (`desktop-v*`). *(bloc maintenu AUTOMATIQUEMENT par le job `manifest` de `desktop.yml`)*

> Après une release desktop : mettre à jour à la main les blocs `macAppStore` et
> `microsoftStore` (version + notes) quand les stores ont validé la publication.
> L'ancien updater Tauri (`latest.json` / `TAURI_SIGNING_PRIVATE_KEY`) n'est plus
> utilisé par la CI.

## 5. Spécificités par plateforme

### macOS (App Store)

- libmpv + FFmpeg recompilés **LGPL** (`build-mpv-lgpl-macos.sh`), sandbox,
  bundle `com.tentacle.mobile` (fiche partagée avec iOS/tvOS, app id `6760205634`).
- Version injectée par `--config` depuis `versions.json` ; CFBundleVersion = build
  auto (croissant global — exigence Apple 90061 réglée à vie).
- MAJ in-app = ouverture App Store (pas d'auto-update). Attributions LGPL :
  `apps/desktop/THIRD-PARTY-LICENSES.md` + À propos → Crédits.

Test local LGPL sans certs :
```bash
bash apps/desktop/scripts/build-mpv-lgpl-macos.sh
cd apps/desktop && VITE_DIST_CHANNEL=appstore pnpm tauri dev
```

### Windows (Microsoft Store)

- Construit par **Electron** depuis la 1.20.0 (`apps/desktop-electron`), plus par
  Tauri : pas de chaîne Rust dans ce job. Même libmpv, piloté par koffi.
- MSIX **non signé** (`makeappx`) — le Store signe. Identité
  `DamienROUGE.Tentacle` (`apps/desktop/msix/Package.appxmanifest`, patché
  `Version="X.Y.Z.0"` par la CI).
- Essai local du paquet : `pnpm --filter @tentacle-tv/desktop-electron package`,
  puis lancer `apps/desktop-electron/release/Tentacle TV-win32-x64/Tentacle TV.exe`.
- Soumission API automatique (`msstore-submit.mjs`) : clone de la dernière
  soumission publiée, notes FR/EN depuis `changelogs/desktop.md`, publication
  immédiate. ⚠️ version strictement supérieure à la publiée.

### Linux

- Runner ubuntu-22.04 (glibc/webkit anciens = compat large), `.deb`/`.rpm`/AppImage
  + repackage pacman (`.pkg.tar.zst`) dans un conteneur Arch.
- libmpv chargé au runtime (dlopen) ; deps déclarées par les paquets
  (libmpv + GStreamer good/bad/libav). AppImage : `mpv`/`fuse2` requis côté user.
- Release GitHub `desktop-vX.Y.Z` + `SHA256SUMS` + manifeste auto-update commité
  sur `main` par le job `manifest`.

### Android TV (Play Console + APK sideload)

- **MÊME app Play que le mobile** : `applicationId com.tentacletv.mobile`
  (namespace Kotlin inchangé `com.tentacletv`). AAB signé avec le **keystore
  d'upload mobile** (secrets `MOBILE_*`), `versionCode = 2000000000 + build`
  (préfixe form-factor : jamais de collision avec les AAB mobile de la fiche).
- Play : piste de tests fermés **« Tests fermés - Alpha »** (id API `alpha`,
  env `PLAY_TV_TRACK` dans `tv.yml`), release en **draft** → promotion manuelle.
  Prérequis console (une fois) : form factor TV activé sur la fiche
  `com.tentacletv.mobile` + accès du compte de service à l'app.
- APK GitHub (`tv-v*` + `tv-latest`) conservé pour le site `tentacletv.app` et le
  code Downloader — désormais **release-signed** : les installs sideload
  antérieures (`com.tentacletv`, debug) se réinstallent une fois.
- Sans secrets keystore, l'APK retombe en debug-signed et l'upload Play est sauté.

### Apple TV (tvOS)

- Projet natif `apps/tv/ios`, `pod install` tvOS, `xcodebuild` archive/export.
- Signature **MANUELLE** : profil App Store tvOS en secret
  (`TVOS_PROVISIONING_PROFILE_BASE64`) — la signature auto refuse de créer un
  profil de distribution pour une 1re app tvOS. Bundle `com.tentacle.mobile`.
- Job `continue-on-error` dans `tv.yml` : un échec tvOS ne bloque pas l'Android TV.

### Doc d'installation utilisateur (Android TV / Shield)

1. **Paramètres → Sécurité & restrictions → Sources inconnues** : autoriser.
2. Installer **Downloader** (AFTVnews) depuis le Play Store.
3. Saisir le lien direct de l'APK (affiché sur `tentacletv.app` ou dans la Release GitHub).
4. Télécharger puis **installer**.

## URLs utiles

- [GitHub Releases](https://github.com/Knaox/Tentacle-TV/releases)
- [GitHub Actions](https://github.com/Knaox/Tentacle-TV/actions)
- [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
- [Google Play Console](https://play.google.com/console)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Tauri v2 Documentation](https://v2.tauri.app)
