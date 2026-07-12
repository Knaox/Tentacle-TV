# Releases par tags — guide développeur

**Un workflow par plateforme, une version par plateforme, un fichier de versions.**
La CI (GitHub Actions, gratuite car repo public) build + signe + envoie.

## Source unique : `versions.json` (racine)

```json
{ "desktop": "1.12.0", "tv": "1.0.0", "mobile": "1.2.2", "server": "1.3.0" }
```

- On change la version **à un seul endroit** ; elle s'applique à tous les OS de la
  plateforme (desktop : macOS + Windows + Linux ensemble).
- Le tag **doit correspondre** (`desktop-v1.12.0` ⇔ `versions.json → desktop = 1.12.0`),
  sinon le job `version` échoue immédiatement (garde-fou).
- Les **numéros de build** (CFBundleVersion / versionCode) sont **AUTO-INCRÉMENTÉS**
  par la CI : minutes écoulées depuis 2024-01-01 UTC. Strictement croissants, jamais
  réutilisés → plus jamais d'erreur Apple 90061 ni de collision TestFlight/Play.
  Android TV : `versionCode = 2000000000 + build` (préfixe form-factor — pas de
  collision avec le mobile sur la même fiche Play).

## Publier

```bash
# 1. Bump versions.json (champ de la plateforme) + remplir changelogs/<plateforme>.md
# 2. Commit + tag + push :
git add versions.json changelogs/
git commit -m "release(desktop): v1.12.0"
git tag desktop-v1.12.0
git push origin main desktop-v1.12.0
```

Le fichier **`Tentacle Deploy.html`** (hors repo) génère cette commande complète.
**Re-livrer une même version** (nouveau build, ex. rejet store) : PAS de re-tag —
relancer en manuel (`gh workflow run tv.yml` ou onglet Actions) : le build est
auto-incrémenté à chaque exécution.

## Plateformes

| Tag | Workflow | Cibles |
|-----|----------|--------|
| `desktop-vX.Y.Z` | `desktop.yml` | macOS → App Store/TestFlight (universal LGPL, sandbox) · Windows → Microsoft Store (MSIX auto) · Linux → Release GitHub `desktop-v*` (.deb/.rpm/AppImage/.pkg.tar.zst) + manifeste auto-update |
| `tv-vX.Y.Z` | `tv.yml` | Android TV → Play Console (AAB, MÊME app que mobile `com.tentacletv.mobile`, piste tests fermés « Alpha », draft) + Release GitHub `tv-v*` + `tv-latest` (APK) · Apple TV → TestFlight (`continue-on-error`) |
| push `main` (sans tag) | `server.yml` | Image `ghcr.io/knaox/tentacle-tv` `:latest` + `:v<server>` ; Release GitHub `server-vX.Y.Z` **si** `versions.json → server` change dans le push |
| `ios-v…` / `play-v…` | `release-ios.yml` / `release-play.yml` | **Mobile — TEMPORAIRE** (pas encore migré) : ancien fonctionnement conservé (version portée par le tag iOS / `app.json` Play, notes dans `CHANGELOG.md` racine). Migration vers `mobile.yml` quand l'app Android sera publiée sur le store. |

> macOS + iOS + tvOS partagent la fiche App Store Connect `com.tentacle.mobile` mais se
> déploient par leurs workflows respectifs. Android TV et Android mobile partagent la
> fiche Play `com.tentacletv.mobile` (form factors distincts, keystore d'upload commun —
> secrets `MOBILE_*`).

## Notes de version (FR + EN) — `changelogs/`

Un fichier par domaine : `changelogs/desktop.md`, `changelogs/tv.md`,
`changelogs/server.md`, `changelogs/mobile.md`. Blocs :

```markdown
## [1.12.0]
### FR
- …
### EN
- …
```

Travaux en cours dans `## [Unreleased]` → renommer en `## [X.Y.Z]` avant le tag.
Sans `### EN`, la section FR sert aux deux langues. Le markdown est converti en
texte brut pour les stores.

| Plateforme | Store | Champ rempli | Limite |
|-----------|-------|--------------|--------|
| desktop (mac) | App Store + TestFlight | « Nouveautés » + « À tester » | 4000 car. |
| desktop (win) | Microsoft Store | « Nouveautés de cette version » (fr-fr + en-us) | 1500 car. |
| desktop (linux) | Release GitHub | corps de la release (markdown) | — |
| tv (android) | Google Play | « Nouveautés » (fr-FR + en-US) | 500 car. |
| tv (android) | Release GitHub | corps de la release (markdown) | — |
| tv (apple) | App Store + TestFlight | « Nouveautés » + « À tester » | 4000 car. |
| server | Release GitHub | corps de la release (markdown) | — |
| mobile (temporaire) | — | blocs `## [ios-…]`/`## [play-…]` de `CHANGELOG.md` racine | 4000 / 500 |

**Flux Apple « je clique juste Publier »** : après l'upload, la CI pose les notes
(`asc-release-notes.mjs`, non bloquant), puis un job séparé attend la fin du traitement du
build (~10-35 min) et le **rattache à la version App Store** avec « À tester »
(`asc-attach-build.mjs`, non bloquant). Il ne reste qu'à cliquer **« Soumettre pour
examen »** dans App Store Connect.

**Microsoft Store** : soumission via `msstore-submit.mjs` (API Store Submission — clone de
la dernière soumission publiée, notes FR/EN, remplacement du package, publication auto).
⚠️ La version soumise doit être **strictement supérieure** à la publiée → re-livrer
Windows exige un bump de `versions.json → desktop`.

**Google Play (TV)** : `tv.yml` génère `whatsnew-fr-FR`/`whatsnew-en-US` depuis
`changelogs/tv.md` (rien n'est envoyé si le bloc n'existe pas). Release en **draft**
sur la piste `alpha` (« Tests fermés - Alpha ») → promotion manuelle dans la console.

Scripts : `.github/scripts/release-notes.mjs` (CLI — `--changelog changelogs/tv.md
--version X.Y.Z`, `--channel` réservé au mode legacy `CHANGELOG.md`),
`asc-release-notes.mjs`, `asc-attach-build.mjs`, `msstore-submit.mjs`
(+ libs `lib/changelog.mjs`, `lib/asc-api.mjs`).

## Pré-requis / assets de signature (secrets GitHub)

| Plateforme | Assets | Statut |
|-----------|--------|--------|
| macOS | Apple Distribution + Mac Installer Distribution + profil MAS | ✅ en place |
| Windows Store | `PARTNER_TENANT_ID` / `PARTNER_CLIENT_ID` / `PARTNER_CLIENT_SECRET` | ✅ en place |
| Apple TV | cert Apple Distribution + profil tvOS (`TVOS_PROVISIONING_PROFILE_BASE64`) | ✅ en place |
| Android TV (Play) | keystore d'upload mobile réutilisé (`MOBILE_KEYSTORE_BASE64/_PASSWORD`, `MOBILE_KEY_ALIAS/_PASSWORD`) + `PLAY_SERVICE_ACCOUNT_JSON` | ✅ secrets en place — côté console : form factor TV + piste « Tests fermés - Alpha » sur la fiche `com.tentacletv.mobile` |
| Apple (commun) | `APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_CONTENT` | ✅ en place |
| Mobile iOS/Play | inchangé (workflows temporaires) | ✅ en place |

> macOS embarque libmpv/FFmpeg recompilés **LGPL** (sandbox App Store). Détails build :
> `apps/desktop/scripts/build-mpv-lgpl-macos.sh`. Voir aussi `docs/RELEASE.md`.
> Conformité chiffrement déclarée exemptée (`ITSAppUsesNonExemptEncryption=false`).
> ⚠️ L'APK Android TV GitHub est désormais **release-signed** et packagé
> `com.tentacletv.mobile` : les installs sideload antérieures (`com.tentacletv`,
> debug) doivent être désinstallées/réinstallées une fois.
