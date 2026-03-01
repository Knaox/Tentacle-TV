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

## 2. Build automatique (GitHub Actions)

Le push du tag `v*` déclenche automatiquement le workflow **Release Desktop** (`.github/workflows/release.yml`).

Le workflow :
1. Installe les dépendances du monorepo pnpm
2. Build le frontend web puis l'app Tauri
3. Génère un `.msi` (WiX) et un `-setup.exe` (NSIS)
4. Crée un **draft release** sur GitHub avec les binaires

### Vérifier le build

```bash
# Voir le statut du workflow
gh run list --workflow=release.yml

# Voir les logs d'un run
gh run view <run-id> --log
```

Une fois le build terminé, aller sur [GitHub Releases](https://github.com/Knaox/Tentacle-TV/releases) pour relire et publier le draft.

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

## URLs utiles

- [GitHub Releases](https://github.com/Knaox/Tentacle-TV/releases)
- [GitHub Actions](https://github.com/Knaox/Tentacle-TV/actions)
- [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
- [Tauri v2 Documentation](https://v2.tauri.app)
- [Tauri Updater Plugin](https://v2.tauri.app/plugin/updater/)
