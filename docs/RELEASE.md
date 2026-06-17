# Tentacle TV — Guide de Release

## Prérequis

- Node.js >= 20
- pnpm >= 10
- Rust stable
- Tauri CLI (`pnpm add -Dg @tauri-apps/cli`)

## 1. Préparer une release

### Mettre à jour la version

Mettre à jour la version dans **tous** les fichiers suivants :

| Fichier | Champ |
|---------|-------|
| `package.json` (racine) | `version` |
| `apps/web/package.json` | `version` |
| `apps/desktop/package.json` | `version` |
| `apps/backend/package.json` | `version` |
| `apps/tv/package.json` | `version` |
| `packages/api-client/package.json` | `version` |
| `packages/shared/package.json` | `version` |
| `packages/ui/package.json` | `version` |
| `apps/desktop/src-tauri/tauri.conf.json` | `version` |
| `apps/desktop/src-tauri/Cargo.toml` | `version` |

> **Note :** `apps/mobile/package.json` a sa propre version indépendante.

### Commit et tag

```bash
git add -A
git commit -m "chore: bump version to 1.0.0"
git tag v1.0.0
git push origin main --tags
```

## 2. Distribution desktop par store

Le desktop n'est plus distribué en DMG/`.exe` hors store. Chaque plateforme passe
par son store, via un workflow manuel dédié :

| Plateforme | Workflow | Section |
|------------|----------|---------|
| **macOS** | `release-appstore.yml` (Mac App Store, universal LGPL) | § 6b |
| **Windows** | `release-store.yml` (Microsoft Store) | § 6 |

> L'ancien `release.yml` (DMG macOS notarisé déclenché par tag `v*`) a été **retiré** :
> macOS est désormais **exclusivement** sur le Mac App Store.

## 3. Configurer les secrets GitHub

Aller dans **GitHub → Settings → Secrets and variables → Actions**.

### Signature updater (recommandé)

Les clés existent déjà dans `apps/desktop/src-tauri/.tauri-keys/` :

```bash
# Afficher la clé privée pour la copier dans GitHub Secrets
cat apps/desktop/src-tauri/.tauri-keys/tentacle.key
```

| Secret | Valeur |
|--------|--------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contenu de `tentacle.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Mot de passe de la clé (vide si aucun) |

### Signature Windows (optionnel)

Si tu as un certificat code-signing (.pfx) :

```bash
# Encoder le certificat en base64
base64 -w 0 certificate.pfx > certificate.b64
```

| Secret | Valeur |
|--------|--------|
| `WINDOWS_CERTIFICATE` | Contenu du .pfx encodé en base64 |
| `WINDOWS_CERTIFICATE_PASSWORD` | Mot de passe du .pfx |

## 4. Régénérer les clés de signature updater

Si tu as besoin de nouvelles clés (rotation) :

```bash
pnpm tauri signer generate -w apps/desktop/src-tauri/.tauri-keys/tentacle.key
```

Puis :
1. Copier la **clé publique** affichée dans `tauri.conf.json` → `plugins.updater.pubkey`
2. Copier le contenu de `tentacle.key` dans le GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`

## 5. Mises à jour automatiques (Updater)

L'app vérifie les mises à jour depuis :
```
https://github.com/Knaox/Tentacle-TV/releases/latest/download/latest.json
```

Le fichier `latest.json` est automatiquement généré par `tauri-action` lors du build.
L'app télécharge et installe la mise à jour en arrière-plan.

## 6. Microsoft Store

### Build Store

Déclencher manuellement le workflow **Build Microsoft Store** :

```bash
gh workflow run release-store.yml -f version=v1.0.0
```

Ou depuis l'onglet **Actions** sur GitHub → **Build Microsoft Store** → **Run workflow**.

Ce build :
- Utilise `tauri.microsoftstore.conf.json` (WebView2 offline)
- Génère uniquement le `-setup.exe` NSIS
- Crée un draft release séparé

### Soumettre sur Partner Center

1. Aller sur [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
2. Créer une nouvelle app ou mettre à jour l'existante
3. Uploader le `-setup.exe` du build Store
4. Remplir les informations (description, captures d'écran, catégorie)
5. Soumettre pour certification

### Informations de l'app

| Champ | Valeur |
|-------|--------|
| Nom | Tentacle TV |
| Éditeur | Damien ROUGE |
| Identifiant | com.tentacle.media |
| Catégorie | Divertissement / Multimédia |

## 6b. Mac App Store

macOS est distribué **exclusivement** via le Mac App Store. Le lecteur embarque un
**libmpv + FFmpeg recompilés en LGPL** (sans x264/x265, sans `--enable-gpl`) — aucune
perte de lecture (x264/x265 sont des encodeurs ; le décodage reste LGPL + VideoToolbox).

### Version
La version App Store est forcée à **1.0.0** par `apps/desktop/src-tauri/tauri.appstore.conf.json`
(override `version`). Les autres fichiers de version (§ 1) ne sont **pas** modifiés.
À chaque resoumission d'une même 1.0.0, incrémenter le **build number** (`CFBundleVersion`).

### Prérequis Apple (une fois)
> macOS est **unifié** avec l'app iOS existante : même bundle id **`com.tentacle.mobile`**
> et même fiche App Store (id `6760205634`). Le build macOS override l'identifier via
> `tauri.appstore.conf.json` (Windows reste sur `com.tentacle.media`).
1. App ID **`com.tentacle.mobile`** : déjà existant (iOS) — rien à créer.
2. Certificats **Apple Distribution** + **Mac Installer Distribution**.
3. **Provisioning profile** Mac App Store pour `com.tentacle.mobile`.
4. Sur App Store Connect : **ajouter la plateforme macOS** à la fiche existante (pas de nouvelle fiche).
5. Secrets GitHub : `APPLE_DISTRIBUTION_CERT_BASE64`/`_PASSWORD`,
   `MAC_INSTALLER_CERT_BASE64`/`_PASSWORD`, `MAS_PROVISIONING_PROFILE_BASE64`,
   et la clé App Store Connect (`APPLE_API_KEY`/`_ISSUER`/`_KEY_CONTENT`, réutilisable).

### Build + soumission
```bash
# Build universal (artefact .pkg seulement)
gh workflow run release-appstore.yml
# Build + envoi automatique à App Store Connect
gh workflow run release-appstore.yml -f submit=true
```
Le workflow : build LGPL par arch (`build-mpv-lgpl-macos.sh`) → app Tauri sandbox
(`--config tauri.appstore.conf.json`, `macOSPrivateApi:false`) → fusion universelle +
signature + `.pkg` (`package-appstore-universal.sh`) → upload via `xcrun altool`.

### Test local (checkpoint LGPL, sans certs)
```bash
bash apps/desktop/scripts/build-mpv-lgpl-macos.sh   # dylibs LGPL (arch hôte)
cd apps/desktop && VITE_DIST_CHANNEL=appstore pnpm tauri dev   # vérifier la lecture H.264/HEVC
```

### Conformité licence
La MAJ in-app ouvre l'**App Store** (pas d'auto-update). Les attributions LGPL sont
dans `apps/desktop/THIRD-PARTY-LICENSES.md` + page **À propos → Crédits**.

## 7. Android TV (APK)

L'Android TV a son **propre tag**, indépendant du desktop : `tv-v*`. Il déclenche
`.github/workflows/release-tv.yml` (et **uniquement** lui — le tag desktop `v*` ne
matche pas `tv-v…`, et un push sur `main` ne déclenche pas le build TV).

### Publier une version Android TV

```bash
# (optionnel) bump versionCode/versionName dans apps/tv/android/app/build.gradle
#             et version dans apps/tv/package.json
git tag tv-v1.0.0
git push origin tv-v1.0.0
```

Le workflow :
1. Installe le monorepo pnpm + JDK 17 + Android SDK/NDK (26.1.10909125).
2. `cd apps/tv/android && ./gradlew assembleRelease` (bundle JS embarqué → APK autonome, **sans Metro**).
3. Crée une **Release GitHub** `tv-v*` avec deux assets : `tentacle-tv-<tag>.apk` et `tentacle-tv.apk` (nom stable).

> La version de l'app n'est **pas** dérivée du tag : elle reste celle de `build.gradle`.

Le site `tentacletv.app` récupère automatiquement la dernière release `tv-*` (asset `.apk`)
via l'API GitHub — le lien de téléchargement est donc toujours à jour.

### Signature

L'APK est signé avec `apps/tv/android/app/debug.keystore` (présent dans le repo) — suffisant
pour le **sideload** (Downloader), **pas** pour le Play Store.

#### TODO — migration vers un keystore release (Play Store)

```bash
keytool -genkeypair -v -keystore tentacle-tv-release.jks -alias tentacle \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 tentacle-tv-release.jks > tentacle-tv-release.b64
```

| Secret GitHub | Valeur |
|---------------|--------|
| `TV_KEYSTORE_BASE64` | Contenu de `tentacle-tv-release.b64` |
| `TV_KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `TV_KEY_ALIAS` | Alias de la clé (`tentacle`) |

Puis dans `apps/tv/android/app/build.gradle` ajouter `signingConfigs.release` lisant ces
valeurs (via `System.getenv`), passer `release { signingConfig signingConfigs.release }`, et
décoder le keystore dans `release-tv.yml` avant `assembleRelease`.

### Doc d'installation utilisateur (Android TV / Shield)

1. **Paramètres → Sécurité & restrictions → Sources inconnues** : autoriser.
2. Installer **Downloader** (AFTVnews) depuis le Play Store.
3. Saisir le lien direct de l'APK (affiché sur `tentacletv.app` ou dans la Release GitHub).
4. Télécharger puis **installer**.

## URLs utiles

- [GitHub Releases](https://github.com/Knaox/Tentacle-TV/releases)
- [GitHub Actions](https://github.com/Knaox/Tentacle-TV/actions)
- [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
- [Tauri v2 Documentation](https://v2.tauri.app)
- [Tauri Updater Plugin](https://v2.tauri.app/plugin/updater/)
