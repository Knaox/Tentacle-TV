# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tentacle TV is a premium multi-platform media client ecosystem for Jellyfin. It features a React web client, a desktop app (Electron on Windows, Tauri on macOS and Linux — both driving the same native mpv), an Expo mobile app, an Android TV app, and a Fastify backend with MariaDB. The project is written primarily in French (comments, context docs, commit messages).

## Commands

```bash
# Development (run web + backend together for full stack)
pnpm dev:web          # Web client on port 5173 (proxies /api to :3001)
pnpm dev:backend      # Backend API on port 3001
pnpm dev:desktop      # Tauri desktop app (macOS, Linux)
pnpm dev:electron     # Electron desktop app (Windows)
pnpm dev:mobile       # Expo mobile app
pnpm dev:tv           # Android TV app

# Build
pnpm build:web        # Production web build (tsc + vite)
pnpm build:backend    # Production backend build (tsc → dist/)

# Quality
pnpm lint             # ESLint across all packages
pnpm typecheck        # TypeScript --noEmit across all packages

# Database (run from apps/backend/)
pnpm db:generate      # prisma generate
pnpm db:push          # prisma db push (sync schema to DB)
pnpm db:migrate       # prisma migrate dev
pnpm db:studio        # Prisma Studio GUI

# Plugins (run from apps/backend/)
pnpm build:shared-deps  # Download tailwind.js + bundle shared-deps.js (required for plugins)

# Docker
pnpm docker:up        # Start MariaDB + Tentacle containers
pnpm docker:reset     # Full teardown + rebuild (volumes included)
pnpm docker:logs      # Tail container logs

# Deploy to production
git push production main  # Triggers post-receive hook on server
```

## Releases / Tags (CI)

**Source unique des versions : `versions.json` (racine)** — champs `desktop`, `tv`, `mobile`, `server`, `minServer` (version serveur minimale exigée par les clients — bannière de compat `useServerCompat.ts`). On change la version À UN SEUL ENDROIT ; le tag doit correspondre (garde-fou CI). Exception desktop : reporter AUSSI le numéro dans `apps/desktop/src-tauri/tauri.conf.json` et `apps/desktop/package.json` (version du bundle lue par « À propos » via `getVersion()` — la CI l'injecte aux builds mac/win/linux, mais le dev lit les fichiers). Les **numéros de build** (CFBundleVersion / versionCode) sont **auto-incrémentés** par la CI (minutes depuis 2024-01-01 UTC — jamais réutilisés, exigence ASC/Play). Un workflow par plateforme :

| Déclencheur | Workflow | Cible |
|-------------|----------|-------|
| tag `desktop-vX.Y.Z` | `.github/workflows/desktop.yml` | **macOS** (App Store/TestFlight, universal LGPL) + **Windows** (Microsoft Store MSIX) + **Linux** (deb/rpm/AppImage/pacman → Release GitHub `desktop-v*` + manifeste auto-update) |
| tag `tv-vX.Y.Z` | `.github/workflows/tv.yml` | **Android TV** (AAB → Play Console UNIQUEMENT — MÊME app que mobile `com.tentacletv.mobile`, piste tests fermés « Alpha », plus d'APK GitHub ; AAB archivé en artefact) + **Apple TV** (tvOS → TestFlight, `continue-on-error`) |
| push `main` | `.github/workflows/server.yml` | Image Docker `ghcr.io/knaox/tentacle-tv` (`:latest` + `:v<server>`) ; si `versions.json → server` change dans le push → Release GitHub `server-vX.Y.Z` |
| tag `mobile-vX.Y.Z` | `.github/workflows/mobile.yml` | **iOS** (TestFlight, `com.tentacle.mobile`) + **Android** (AAB → Play Console, piste tests fermés « alpha », MÊME fiche `com.tentacletv.mobile` que la TV) — build auto-incrémenté (`versionCode = build` nu, sous le préfixe TV `2e9+`), notes `changelogs/mobile.md`. `target` (dispatch) : `all`/`android`/`ios`. |

**Publier** : bump `versions.json` + remplir `changelogs/<plateforme>.md` (bloc `## [X.Y.Z]`, `### FR`/`### EN`), commit, puis `git tag desktop-v1.12.0 && git push origin main desktop-v1.12.0`. Le fichier `Tentacle Deploy.html` (hors repo, Desktop) génère la commande complète. Re-livrer une même version (nouveau build) : relancer via `workflow_dispatch` (`gh workflow run tv.yml`) — le build est auto-incrémenté.

- **Changelogs par domaine** : `changelogs/{desktop,tv,server,mobile}.md`. Limites stores gérées (`.github/scripts/lib/changelog.mjs`) : ASC 4000, MS Store 1500, Play 500 caractères. `CHANGELOG.md` racine = archive pure (les anciens blocs `ios-`/`play-` y restent, mais `mobile.yml` lit désormais `changelogs/mobile.md`).
- **Desktop = stores uniquement** (macOS App Store, Windows Microsoft Store) ; Linux = Release GitHub. Un échec d'un OS ne bloque pas les autres (jobs indépendants).
- **Android TV = Play Console uniquement** : même fiche que le mobile (`com.tentacletv.mobile`), keystore d'upload mobile réutilisé (secrets `MOBILE_*`), `versionCode = 2000000000 + build` (préfixe form-factor, jamais en collision avec le mobile qui utilise `build` nu). Piste TV = `tv:Alpha` (id API préfixé) ≠ piste mobile = `alpha`. **Plus d'APK GitHub ni de `tv-latest`** : la distribution passe par la piste de tests fermés (opt-in Play) — le site `tentacletv.app` doit pointer vers le lien d'opt-in du test, plus vers un APK.
- **Apple TV** : signature MANUELLE (profil `TVOS_PROVISIONING_PROFILE_BASE64`) ; l'app tvOS reste à finaliser (icône placeholder).
- Versions affichées (À propos) : web = `versions.json → server`, desktop = version du bundle (injectée depuis `versions.json`), TV = `versions.json → tv` (`AboutScreen.tsx`).

## Architecture

### Monorepo Structure (pnpm workspaces)

```
apps/web/        → React 19 + Vite 6 + Tailwind CSS (main web client)
apps/desktop/    → Tauri v2 (macOS, Linux — wraps web build for native desktop)
apps/desktop-electron/ → Electron (Windows — same web build, same libmpv)
apps/mobile/     → Expo 52 + React Native 0.76 (iOS/Android)
apps/tv/         → React Native for Android TV
apps/backend/    → Fastify 5 + Prisma 6 + MariaDB

packages/shared/      → Types, i18n translations, constants (used by all)
packages/api-client/  → Jellyfin API client + TanStack Query hooks
packages/ui/          → Shared React components (GlassCard, MediaCard, Shimmer)
packages/plugins-api/ → Plugin system interfaces
```

### Dependency Graph

- `web` → `ui`, `api-client`, `shared`, `plugins-api`
- `desktop` → wraps `web` build via Tauri (macOS, Linux)
- `desktop-electron` → wraps the same `web` build via Electron (Windows)
- `mobile` → `api-client`, `shared` (own UI with NativeWind)
- `backend` → `shared` only

### Backend (apps/backend/src/)

- **Entry**: `index.ts` — Fastify app with plugin loader, setup guard, DB retry
- **Auth**: JWT-based (`middleware/auth.ts`), tokens via `services/jwt.ts`
- **Routes**: `routes/` — setup, auth, config, demo, health, invites, jellyfin (proxy), notifications, pair, plugins, preferences, admin, tickets, update
- **Services**: `services/` — db.ts (Prisma), jellyfin.ts, configStore.ts, pluginManager.ts
- **Database**: MariaDB via Prisma ORM, schema at `prisma/schema.prisma`

### Frontend (apps/web/src/)

- **Routing**: React Router DOM v7 in `App.tsx`
- **State**: TanStack React Query v5 for all Jellyfin API data
- **Video**: Video.js 8 + hls.js for streaming, direct play prioritized
- **Styling**: Tailwind CSS with dark glassmorphism theme (purple/pink accents)
- **Animations**: Framer Motion 11

### API Flow

Two API targets from the frontend:
1. **Custom Backend** (`/api/*` proxied to :3001) — auth, invites, tickets, config, pairing
2. **Jellyfin Direct** (configured URL) — streaming, media browsing, user data via `X-Emby-Token`

### Plugin System

Extensible plugin architecture with admin marketplace. Plugins can add frontend routes and backend endpoints. Plugin registry loaded from GitHub or custom sources with SHA256 verification.

## Coding Standards

- **300 lines MAX per file** — refactor into sub-components, hooks, or utilities if exceeded
- **Performance**: use `memo`, `useCallback`, `useMemo` to prevent re-renders; lazy load images with shimmer skeletons
- **Video**: direct play first, 30s pre-buffer, automatic transcode fallback on codec errors

### Coût GPU — ce qui n'est pas affiché ne doit rien consommer

Trois règles, chacune payée par une régression mesurée à `powermetrics`. Elles
tiennent surtout sur le web (WebKit et Chromium), pas sur les clients natifs.

1. **Un `backdrop-filter` masqué par `opacity: 0` n'est pas gratuit.** La couche
   composée subsiste, son arrière-plan est recopié et son flou recalculé — à
   chaque image si ce qui est derrière bouge. Un contrôle en verre révélé au
   survol se **monte** à la demande (`useHoverMount` + `.hover-reveal`, qui
   rendent les deux fondus), il ne se masque pas.
2. **Une animation infinie se garde par `useInViewport`** — `animation-play-state:
   paused` pour reprendre où l'on s'est arrêté, démontage quand l'élément est
   coûteux à garder (image floutée, `mix-blend-mode`). Le hook couvre aussi la
   fenêtre passée en arrière-plan.
3. **N'animer que `transform` et `opacity`.** `background-position`,
   `box-shadow`, `background-color` et `filter` déclenchent une peinture par
   image ; sur un calque plein écran, c'est tout le viewport qui est repeint.
   Pour une ombre au survol : deux calques en fondu d'opacité, jamais un
   `box-shadow` animé (cf. `theme/cards.css`).

Corollaire de la première règle : un `backdrop-filter` derrière un fond à plus de
~0,9 d'alpha ne floute rien de visible — le retirer ne change pas le rendu et
supprime une passe de compositing. Vérifier avant d'en poser un.

Mesure de référence : `sudo powermetrics --samplers gpu_power -i 1000 -n 10` sur
un **build de production** (le compteur d'images de `dev/` tient une boucle
`requestAnimationFrame` permanente qui fausse toute mesure au repos).
- **Functional components only**, strict TypeScript everywhere
- **Jellyfin admin API key stays in backend `.env` only**, never exposed to frontend
- **UI theme**: dark glassmorphism, gradient accents (purple → pink)

## Tech Stack Quick Reference

| Layer | Technology |
|-------|-----------|
| Web | React 19, Vite 6, Tailwind 3, Framer Motion 11 |
| Desktop | Electron 43 (Windows), Tauri v2 / Rust (macOS, Linux) |
| Mobile | React Native 0.76, Expo 52, NativeWind 4 |
| Backend | Fastify 5, Prisma 6, MariaDB 11 |
| Data | TanStack Query v5 |
| Video | hls.js 1.6 + HTML5 `<video>` (web), react-native-video (mobile/TV) |
| i18n | i18next + react-i18next (FR/EN) |
| Validation | Zod 3.24 |
| TypeScript | 5.7, strict mode, ES2022 target |
