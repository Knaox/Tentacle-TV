# Tentacle TV — Guide de Release

> **Vue d'ensemble à jour : `docs/RELEASE-TAGS.md`** (source unique `versions.json`,
> 3 workflows plateforme, builds auto-incrémentés). Ce guide couvre les détails
> par plateforme (secrets, signature, spécificités stores).

## Prérequis

- Node.js >= 20
- pnpm >= 10
- Rien de plus : les trois systèmes de bureau sortent d’Electron. La chaîne Rust
  et Tauri ont disparu avec la migration de Linux.

## 1. Préparer une release

### Écrire les notes — le SEUL geste manuel

Remplir `changelogs/<plateforme>.md` (bloc `## [X.Y.Z]`, `### FR` / `### EN`) et
le pousser. C'est de la prose : elle ne s'écrit pas toute seule, et le reste ne
part pas sans elle — le pré-vol (`check-changelog.mjs`) refuse une livraison dont
le bloc manque, AVANT le moindre build.

### La version, elle, est posée par la CI

`versions.json` (racine) reste la **source unique**, mais on ne l'édite plus à la
main : on demande une version dans la page de déploiement, et le job `prepare` du
workflow l'écrit, aligne le `package.json` de la cible, commite, tague et pousse.

```json
{ "desktop": "1.21.4", "tv": "1.3.0", "webos": "1.0.0", "mobile": "1.8.0", "server": "1.18.1", "minServer": "1.18.1" }
```

- Les numéros de build (CFBundleVersion / versionCode) sont **auto-incrémentés**
  par la CI — rien à gérer.
- `minServer` reste manuel : c'est une exigence, pas une livraison.
- Réparer à la main si besoin :
  `node .github/scripts/bump-version.mjs <clé> <X.Y.Z> [--dry-run]`.

### Livrer

Ouvrir **`Tentacle Deploy.html`** (Bureau, hors dépôt), choisir la plateforme,
les cibles et le cran, puis cliquer. Rien d'autre.

Le détail des crans, des gardes et des pièges par store :
**`docs/RELEASE-TAGS.md`**.

## 2. Workflows

| Workflow | `targets` | Cibles |
|----------|-----------|--------|
| `desktop.yml` | `macos` `windows` `linux` | Mac App Store · Microsoft Store · Release GitHub + auto-update |
| `mobile.yml` | `android` `ios` | Play (test fermé « alpha » ou production) · App Store |
| `tv.yml` | `androidtv` `appletv` | Play (piste TV `tv:Alpha` ou production) · App Store tvOS |
| `webos.yml` | `ipk` | Release GitHub (`webos-latest` au cran store) |
| `server.yml` | `docker` | `ghcr.io/knaox/tentacle-tv` + Release GitHub |

Trois crans partout : `build` (artefacts seuls), `test` (publié aux testeurs,
sans geste ensuite), `store` (en ligne, sans un clic de plus). Les tags
`<plateforme>-vX.Y.Z` restent acceptés et valent le cran `store`.

> ⚠️ **Le serveur ne part plus au push.** `git push origin main` ne déploie rien.
> Le remote `production` n'existe plus non plus : `origin` est le seul.

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

- Coquille : **Electron** (`apps/desktop-electron`), comme Windows — même web build,
  même libmpv piloté par koffi.
- libmpv + FFmpeg recompilés **LGPL** (`build-mpv-lgpl-macos.sh`), sandbox,
  bundle `com.tentacle.mobile` (fiche partagée avec iOS/tvOS, app id `6760205634`).
- Version injectée par `--version` depuis `versions.json` (elle atterrit dans le
  `package.json` embarqué, donc dans `app.getVersion()` — c'est elle que la
  détection de MAJ compare au manifeste) ; CFBundleVersion = build auto (croissant
  global — exigence Apple 90061 réglée à vie).
- MAJ in-app = ouverture App Store (pas d'auto-update ; le paquet `mas` d'Electron
  n'embarque pas Squirrel). Attributions LGPL :
  `apps/desktop/THIRD-PARTY-LICENSES.md` + À propos → Crédits.
- Deux jobs : `mac-libs` compile mpv/FFmpeg LGPL **par architecture** (et récolte
  le binaire natif koffi de son arch, indisponible ailleurs), `mac-package` fusionne
  au `lipo`, empaquette en universel, signe et envoie.

> ⚠️ Deux réglages du packaging ont un coût s'ils sautent, et il ne se voit
> qu'après l'envoi : `osxUniversal.x64ArchFiles` (sans quoi la fusion universelle
> refuse les `koffi.node` mono-architecture) et `preAutoEntitlements: false` (sans
> quoi osx-sign ajoute `application-groups`, absent du profil de provisionnement —
> build inéligible). Voir les commentaires de `package-macos.mjs`.

Test local (paquet universel non distribuable, signature ad hoc) :
```bash
bash apps/desktop-electron/scripts/build-mpv-lgpl-macos.sh    # dylibs LGPL de l'arch hôte
cd apps/desktop-electron
pnpm build:appstore
node scripts/package-macos.mjs --lib ./lib/mpv --arch arm64
```

### Windows (Microsoft Store)

- Construit par **Electron** depuis la 1.20.0 (`apps/desktop-electron`), plus par
  Tauri : pas de chaîne Rust dans ce job. Même libmpv, piloté par koffi.
- MSIX **non signé** (`makeappx`) — le Store signe. Identité
  `DamienROUGE.Tentacle` (`apps/desktop-electron/msix/Package.appxmanifest`, patché
  `Version="X.Y.Z.0"` par la CI).
- Essai local du paquet : `pnpm --filter @tentacle-tv/desktop-electron package`,
  puis lancer `apps/desktop-electron/release/Tentacle TV-win32-x64/Tentacle TV.exe`.
- Soumission API automatique (`msstore-submit.mjs`) : clone de la dernière
  soumission publiée, notes FR/EN depuis `changelogs/desktop.md`, publication
  immédiate. ⚠️ version strictement supérieure à la publiée.

### Linux

- Coquille : **Electron**, comme Windows et macOS. Même `apps/desktop-electron`,
  même libmpv pilotée par koffi.
- Runner **ubuntu-22.04**, et le choix n’est pas historique : la glibc est
  compatible vers l’avant et jamais vers l’arrière. Une chaîne bâtie là tourne
  sur Arch ; bâtie sur Arch, elle ne tournerait pas sur Ubuntu.
- Les quatre formats sortent du même job — electron-builder produit le paquet
  pacman lui-même, il n’y a plus de conteneur Arch.
- **mpv est embarqué** (`scripts/build-mpv-linux.sh`, mis en cache sur l’empreinte
  du script). FFmpeg en LGPL, mpv en **GPL** : son backend X11 vient de MPlayer et
  meson le refuse hors GPL — sans lui, aucune vidéo sur les sessions X11.
- Release GitHub `desktop-vX.Y.Z` + `SHA256SUMS` + manifeste auto-update commité
  sur `main` par le job `manifest`.
- HDR : sessions **Wayland** seulement, avec un compositeur qui gère la couleur.
  X.Org n’a pas de gestion de couleur et n’en aura pas. Voir
  `docs/LINUX-FENETRE-VIDEO.md` pour le relevé complet.

### Android TV (Play Console uniquement)

- **MÊME app Play que le mobile** : `applicationId com.tentacletv.mobile`
  (namespace Kotlin inchangé `com.tentacletv`). AAB signé avec le **keystore
  d'upload mobile** (secrets `MOBILE_*`), `versionCode = 2000000000 + build`
  (préfixe form-factor : jamais de collision avec les AAB mobile de la fiche).
- Play : piste de tests fermés **« Tests fermés - Alpha »** (id API `alpha`,
  env `PLAY_TV_TRACK` dans `tv.yml`), release en **draft** → promotion manuelle.
  Prérequis console (une fois) : form factor TV activé sur la fiche
  `com.tentacletv.mobile` + accès du compte de service à l'app.
- **Plus d'APK GitHub ni de `tv-latest`** : la distribution passe uniquement par la
  piste Play. L'AAB est archivé en artefact du run, rien n'est publié sur GitHub.

### Apple TV (tvOS)

- Projet natif `apps/tv/ios`, `pod install` tvOS, `xcodebuild` archive/export.
- Signature **MANUELLE** : profil App Store tvOS en secret
  (`TVOS_PROVISIONING_PROFILE_BASE64`) — la signature auto refuse de créer un
  profil de distribution pour une 1re app tvOS. Bundle `com.tentacle.mobile`.
- Job `continue-on-error` dans `tv.yml` : un échec tvOS ne bloque pas l'Android TV.

### Doc d'installation utilisateur (Android TV / Shield)

Plus de sideload : l'app s'installe depuis le Play Store, sur la fiche
`com.tentacletv.mobile` (form factor TV). Les testeurs passent par le lien d'opt-in
de la piste de tests fermés « Alpha », puis installent depuis le Play Store de la TV.

## URLs utiles

- [GitHub Releases](https://github.com/Knaox/Tentacle-TV/releases)
- [GitHub Actions](https://github.com/Knaox/Tentacle-TV/actions)
- [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
- [Google Play Console](https://play.google.com/console)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Electron Documentation](https://www.electronjs.org/docs/latest) (coquilles Windows et macOS)
