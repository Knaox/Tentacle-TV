# Tentacle TV — Guide de Release

> **Vue d'ensemble à jour : `docs/RELEASE-TAGS.md`** (source unique `versions.json`,
> 3 workflows plateforme, builds auto-incrémentés). Ce guide couvre les détails
> par plateforme (secrets, signature, spécificités stores).

## Prérequis

- Node.js >= 20
- pnpm >= 10
- Bureau (1.50.0 et après) : la coquille CEF `apps/desktop-cef` (C++ — CMake,
  Ninja ; CEF, SDL3 et la chaîne mpv sont épinglés par ses scripts). Prérequis par
  système : `apps/desktop-cef/README.md`.

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
| `webos.yml` | — | Release GitHub (`webos-latest` au cran store) + image serveur reconstruite avec le client LG (`:vS-webos-X.Y.Z`, `:latest` au cran store) |
| `server.yml` | — | `ghcr.io/knaox/tentacle-tv` + Release GitHub — le client LG de l'image est repris de `:latest` |

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

> **Bureau CEF (1.50.0)** : la coquille a son propre moteur de mise à jour (manifeste
> signé, `apps/desktop-cef/docs/MISE-A-JOUR.md`). Ce qui suit est le mécanisme du bureau
> d'avant ; il reste à rapprocher de `desktop.yml` une fois celui-ci réécrit.

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

### Bureau — la coquille CEF (depuis la 1.50.0)

Les trois systèmes sortent de `apps/desktop-cef` : CEF (Chromium Embedded
Framework) + SDL3 + libmpv, le même front `apps/web` servi sous `tentacle://app`.
La recette de CI vit dans `desktop.yml` (en cours de réécriture pour cette coquille :
c'est lui qui fait foi pour les jobs, les secrets et les canaux). Ce qui est déjà
établi :

- **Mise à jour** : moteur propre aux trois systèmes (manifeste signé ed25519,
  assistant `tentacle-update`, installation à la fermeture, retour arrière) —
  `apps/desktop-cef/docs/MISE-A-JOUR.md`.
- **macOS (Apple Silicon)** : `scripts/build.sh --dist` construit un `Tentacle.app`
  autonome — chaîne de lecture LGPL (`scripts/deps/paquet-deps.sh` : FFmpeg n9.0.2
  `--disable-gpl --disable-nonfree`, libmpv du fork + correctifs du dépôt), 20 dylibs
  dans `Contents/Frameworks`, licences dans `Contents/Resources/licenses`. Ordre de
  signature exigé par Developer ID : `apps/desktop-cef/docs/PAQUET.md`, « Signature ».
- **Windows** : build MSVC (`scripts/dev/windows.mjs`) ; libmpv = la `libmpv-2.dll`
  LGPL de mpv-winbuild (épinglée par empreinte, `windows-deps.mjs`) ; mise à jour MSIX
  reconnue (`src/platform/windows/msix_update_windows.*`). Jamais essayé sur une vraie
  machine : `apps/desktop-cef/docs/A-TESTER-WINDOWS.md`.
- **Linux** : notre libmpv (`-Dgpl=false`, sortie Wayland par sous-surface) ;
  `cmake/LinuxApp.cmake` pose l'exécutable et ce que CEF cherche à côté — le paquet de
  distribution (AppImage, rpm…) reste à écrire. HDR : sessions **Wayland** seulement, avec
  un compositeur qui gère la couleur — X.Org n'a pas de gestion de couleur et n'en
  aura pas. À essayer : `apps/desktop-cef/docs/A-TESTER-LINUX.md`.
- **Attributions** : `apps/desktop-cef/THIRD-PARTY-LICENSES.md` + À propos → Crédits.

> Jusqu'à la 1.4x, le bureau était Electron (`apps/desktop-electron`, retiré du
> dépôt) : Mac App Store universel, MSIX, deb/rpm/pacman/AppImage. Les Releases
> `desktop-v1.4x` restent ce qu'elles sont.

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

### Serveur (image Docker)

- **Le client LG (`/tv`) n'est pas livré par `server.yml`** : il est repris de
  l'image en service. C'est `webos.yml` qui le livre, en reconstruisant l'image
  sur `:vS` avec son client (notes `changelogs/server-webos.md`). Le détail,
  les gardes et le plan rejouable : `docs/RELEASE-TAGS.md`, « Le serveur et le
  client LG ».
- **yt-dlp** (bandes-annonces YouTube de l'Apple TV) : l'image épingle le zipapp
  officiel. Monter de version = `YTDLP_VERSION` et `YTDLP_SHA256` du `Dockerfile`
  (la ligne `yt-dlp` du `SHA2-256SUMS` de la release) ; entre deux images, le
  backend pose seul la dernière version (`services/ytDlp.ts`, `TENTACLE_YTDLP_AUTOUPDATE=0`
  pour s'en tenir à l'épinglée).
- **Plus de ffmpeg ni de fpcalc** dans l'image depuis le retrait de l'analyse
  audio (2026-10-15) : plus rien à monter de ce côté.
- **Poids de l'image** : le `node_modules` final vient de `pnpm deploy --prod`
  (le serveur seul), élagué par `apps/backend/docker/prune-node-modules.sh`.
  Une dépendance de production ajoutée au serveur y entre d'elle-même ; un
  fichier dont elle aurait besoin à l'exécution et que l'élagage retire
  (`docs/`, `test/`, `*.ts`…) se rétablit dans ce script.
- **Dépendances = verrou, au paquet près** : `pnpm deploy` SANS `--legacy`
  (qui ignorait `pnpm-lock.yaml` et résolvait au registre : fastify 5.12 au lieu
  de 5.7, undici 7 au lieu de 6, relevé du 2026-10-08), puis
  `apps/backend/docker/check-lockfile-deps.mjs`, qui fait échouer le build si un
  paquet installé s'écarte du verrou ou si le verrou est périmé — « Verrou
  périmé » : `pnpm install`, commiter `pnpm-lock.yaml`. Le même contrôle se
  rejoue sur une image livrée (`node check-lockfile-deps.mjs pnpm-lock.yaml
  apps/backend <node_modules extrait>`).

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
- [CEF](https://github.com/chromiumembedded/cef) et ses [distributions binaires](https://cef-builds.spotifycdn.com) (coquille du bureau)
