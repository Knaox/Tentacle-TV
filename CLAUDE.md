# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tentacle TV is a premium multi-platform media client ecosystem for Jellyfin. It features a React web client, Tauri desktop app, Expo mobile app, Android TV app, and a Fastify backend with MariaDB. The project is written primarily in French (comments, context docs, commit messages).

## Commands

```bash
# Development (run web + backend together for full stack)
pnpm dev:web          # Web client on port 5173 (proxies /api to :3001)
pnpm dev:backend      # Backend API on port 3001
pnpm dev:desktop      # Tauri desktop app
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

Le déclencheur de build dépend du **préfixe de tag** — les builds des plateformes sont isolés :

| Déclencheur | Workflow | Cible |
|-------------|----------|-------|
| tag `mac-v*` ou manuel | `.github/workflows/release-appstore.yml` | **macOS — Mac App Store / TestFlight** (universal, libmpv/FFmpeg **LGPL**, sandbox) |
| tag `ios-v*` ou manuel | `.github/workflows/release-ios.yml` | **iOS — TestFlight** (natif sans EAS, signature auto via clé API ASC) |
| tag `apk-v*` ou manuel | `.github/workflows/release-android.yml` | **Android mobile — APK** (debug-signed, Release GitHub) |
| tag `tv-v*` (ex `tv-v1.0.0`) | `.github/workflows/release-tv.yml` | **Android TV** — APK release en Release GitHub + `tv-latest` |
| tag `atv-v*` ou manuel | `.github/workflows/release-atv.yml` | **Apple TV (tvOS) — TestFlight** (natif sans EAS, signature auto) |
| manuel (`workflow_dispatch`) | `.github/workflows/release-store.yml` | **Windows — Microsoft Store** (NSIS) |
| push `main` | `.github/workflows/docker.yml` | Image Docker `ghcr.io/knaox/tentacle-tv` |

- **Desktop = stores uniquement** : le DMG macOS notarisé (ancien `release.yml`, tag `v*`) a été **retiré** ; macOS passe exclusivement par le Mac App Store. Détails : `docs/RELEASE.md` § 6b.
- Un tag `tv-v*` ne déclenche que l'Android TV.
- **Publier l'Android TV** : `git tag tv-v1.0.0 && git push origin tv-v1.0.0`. La version de l'app (`versionName`) n'est pas modifiée par le tag — elle reste celle de `apps/tv/android/app/build.gradle`.
- APK signé avec le `debug.keystore` du repo (sideload uniquement). Migration vers un keystore release : voir `docs/RELEASE.md`.
- Le site `tentacletv.app` pointe automatiquement sur la dernière release `tv-*` (asset `.apk`).

### Releases par tags (guide : `docs/RELEASE-TAGS.md`)
Nomenclature `<canal>-v<version>-<build>` (le `-build` = CFBundleVersion/versionCode → ré-upload TestFlight sans bump de version). Notes FR+EN auto depuis `CHANGELOG.md` (blocs `## [x.y.z]` avec `### FR`/`### EN`).
- 🛠️ **Outil** : `tools/deploy/tentacle-deploy.html` (copie sur le Bureau) — UI pour générer le tag + la commande `git tag … && git push …` sans rien retenir.
- ✅ **macOS App Store / TestFlight** : `mac-v*` → `release-appstore.yml` (universal, libmpv/FFmpeg **LGPL**, sandbox, transparence ON). Ex. `git tag mac-v1.0.0-5 && git push origin mac-v1.0.0-5`.
- ✅ **iOS → TestFlight** : `ios-v*` → `release-ios.yml` (natif **sans EAS**, projet `apps/mobile/ios` versionné, `pod install` + `xcodebuild` archive/export, signature **automatique** via clé API ASC + cert Apple Distribution, `com.tentacle.mobile`). Même fiche App Store que macOS, déploiement séparé.
- ✅ **Apple TV → TestFlight** : `atv-v*` → `release-atv.yml` (natif **sans EAS**, projet `apps/tv/ios` versionné, `pod install` tvOS + `xcodebuild` archive/export, signature **automatique**, bundle `com.tentacle.mobile`). Version via build settings (Info.plist tvOS référence `$(MARKETING_VERSION)`). **Pré-requis Apple** : activer la plateforme tvOS sur la fiche ASC `com.tentacle.mobile`.
- ✅ **Android TV** : `tv-v*` (versionName/Code depuis le tag).
- ✅ **APK Android mobile** : `apk-v*` → `release-android.yml` (debug-signed, sideload, Release GitHub ; versionName/Code depuis le tag). Aussi en manuel.

**Reste à faire (besoin d'assets de signature) :**
- **Android mobile (Play Store)** : keystore release → secrets + `signingConfigs.release` (l'APK reste debug-signed sideload en attendant le compte Play validé).
- **Apple TV** : activer la plateforme tvOS sur la fiche App Store Connect `com.tentacle.mobile` (1er upload) ; finaliser l'app tvOS (lecteur/UI).

## Architecture

### Monorepo Structure (pnpm workspaces)

```
apps/web/        → React 19 + Vite 6 + Tailwind CSS (main web client)
apps/desktop/    → Tauri v2 (wraps web build for native desktop)
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
- `desktop` → wraps `web` build via Tauri
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
- **Functional components only**, strict TypeScript everywhere
- **Jellyfin admin API key stays in backend `.env` only**, never exposed to frontend
- **UI theme**: dark glassmorphism, gradient accents (purple → pink)

## Tech Stack Quick Reference

| Layer | Technology |
|-------|-----------|
| Web | React 19, Vite 6, Tailwind 3, Framer Motion 11 |
| Desktop | Tauri v2 (Rust) |
| Mobile | React Native 0.76, Expo 52, NativeWind 4 |
| Backend | Fastify 5, Prisma 6, MariaDB 11 |
| Data | TanStack Query v5 |
| Video | hls.js 1.6 + HTML5 `<video>` (web), react-native-video (mobile/TV) |
| i18n | i18next + react-i18next (FR/EN) |
| Validation | Zod 3.24 |
| TypeScript | 5.7, strict mode, ES2022 target |
