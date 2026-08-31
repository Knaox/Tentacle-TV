# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tentacle TV is a premium multi-platform media client ecosystem for Jellyfin. It features a React web client, a desktop app (Electron on Windows, macOS and Linux, driving a native mpv through koffi), an Expo mobile app, an Android TV app, and a Fastify backend with MariaDB. The project is written primarily in French (comments, context docs, commit messages).

## Commands

```bash
# Development (run web + backend together for full stack)
pnpm dev:web          # Web client on port 5173 (proxies /api to :3001)
pnpm dev:backend      # Backend API on port 3001
pnpm dev:electron     # Electron desktop app (Windows, macOS, Linux)
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

**Source unique des versions : `versions.json` (racine)** — champs `desktop`, `tv`, `mobile`, `server`, `minServer` (version serveur minimale exigée par les clients — bannière de compat `useServerCompat.ts`). On change la version À UN SEUL ENDROIT ; le tag doit correspondre (garde-fou CI). Exception desktop : reporter AUSSI le numéro dans `apps/desktop-electron/package.json`. C'est la version du bundle lue par « À propos » ; la CI l'injecte aux builds mac/win/linux, mais le dev lit le fichier. Les **numéros de build** (CFBundleVersion / versionCode) sont **auto-incrémentés** par la CI (minutes depuis 2024-01-01 UTC — jamais réutilisés, exigence ASC/Play). Un workflow par plateforme :

| Déclencheur | Workflow | Cible |
|-------------|----------|-------|
| tag `desktop-vX.Y.Z` | `.github/workflows/desktop.yml` | **macOS** (App Store/TestFlight, universal LGPL) + **Windows** (Microsoft Store MSIX) + **Linux** (deb/rpm/pacman/AppImage, **mpv embarqué** → Release GitHub `desktop-v*` + manifeste auto-update) |
| tag `tv-vX.Y.Z` | `.github/workflows/tv.yml` | **Android TV** (AAB → Play Console UNIQUEMENT — MÊME app que mobile `com.tentacletv.mobile`, piste tests fermés « Alpha », plus d'APK GitHub ; AAB archivé en artefact) + **Apple TV** (tvOS → TestFlight, `continue-on-error`) |
| push `main` | `.github/workflows/server.yml` | Image Docker `ghcr.io/knaox/tentacle-tv` (`:latest` + `:v<server>`) ; si `versions.json → server` change dans le push → Release GitHub `server-vX.Y.Z` |
| tag `mobile-vX.Y.Z` | `.github/workflows/mobile.yml` | **iOS** (TestFlight, `com.tentacle.mobile`) + **Android** (AAB → Play Console, piste tests fermés « alpha », MÊME fiche `com.tentacletv.mobile` que la TV) — build auto-incrémenté (`versionCode = build` nu, sous le préfixe TV `2e9+`), notes `changelogs/mobile.md`. `target` (dispatch) : `all`/`android`/`ios`. |

**Publier** : bump `versions.json` + remplir `changelogs/<plateforme>.md` (bloc `## [X.Y.Z]`, `### FR`/`### EN`), commit, puis `git tag desktop-v1.12.0 && git push origin main desktop-v1.12.0`. Le fichier `Tentacle Deploy.html` (hors repo, Desktop) génère la commande complète. Re-livrer une même version (nouveau build) : relancer via `workflow_dispatch` (`gh workflow run tv.yml`) — le build est auto-incrémenté.

- **Changelogs par domaine** : `changelogs/{desktop,tv,server,mobile}.md`. Limites stores gérées (`.github/scripts/lib/changelog.mjs`) : ASC 4000, MS Store 1500, Play 500 caractères. `CHANGELOG.md` racine = archive pure (les anciens blocs `ios-`/`play-` y restent, mais `mobile.yml` lit désormais `changelogs/mobile.md`).
- **Desktop = stores uniquement** (macOS App Store, Windows Microsoft Store) ; Linux = Release GitHub, avec auto-updater intégré (deb/rpm/pacman/AppImage). Un échec d'un OS ne bloque pas les autres (jobs indépendants).
- **Android TV = Play Console uniquement** : même fiche que le mobile (`com.tentacletv.mobile`), keystore d'upload mobile réutilisé (secrets `MOBILE_*`), `versionCode = 2000000000 + build` (préfixe form-factor, jamais en collision avec le mobile qui utilise `build` nu). Piste TV = `tv:Alpha` (id API préfixé) ≠ piste mobile = `alpha`. **Plus d'APK GitHub ni de `tv-latest`** : la distribution passe par la piste de tests fermés (opt-in Play) — le site `tentacletv.app` doit pointer vers le lien d'opt-in du test, plus vers un APK.
- **Apple TV** : signature MANUELLE (profil `TVOS_PROVISIONING_PROFILE_BASE64`) ; l'app tvOS reste à finaliser (icône placeholder).
- Versions affichées (À propos) : web = `versions.json → server`, desktop = version du bundle (injectée depuis `versions.json`), TV = `versions.json → tv` (`AboutScreen.tsx`).

## Architecture

### Monorepo Structure (pnpm workspaces)

```
apps/web/        → React 19 + Vite 6 + Tailwind CSS (main web client)
apps/desktop-electron/ → Electron (Windows, macOS, Linux — same web build, same libmpv)
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
- `desktop-electron` → wraps the `web` build via Electron (Windows, macOS, Linux)
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

## Marque — le logo ne se dessine qu'à un seul endroit

`brand/` est la source unique. Rien de ce qui en dérive ne se retouche à la main :

```bash
python3 brand/generate-svg.py brand      # les 15 SVG + 3 modules TS
python3 brand/generate-icons.py --write  # les 83 binaires (aperçu sans --write)
pnpm --filter @tentacle-tv/tv-webos icons  # webOS, à part — voir plus bas
```

`generate-svg.py` écrit aussi les constantes consommées par les clients :
`apps/web/src/components/ui/tentacleArmPaths.generated.ts` et
`tentacleArt.generated.ts` pour la TV et le mobile. Les bras sont des spirales
échantillonnées — elles ne se recopient pas à la main, et trois copies auraient
divergé. Côté natif les `dasharray` sont en unités RÉELLES de tracé :
`pathLength` n'existe que dans le rendu web de react-native-svg.

Trois pièges déjà payés :

- **webOS a son propre script** (`apps/tv-webos/scripts/icons.mjs`) et
  `generate-icons.py` l'ignore volontairement : il faut un maître de 5200 px
  réduit en Lanczos, un fond opaque calibré sur `iconColor`, et un splash qui ne
  soit pas noir. Son `SUBJECT` se REMESURE si le dessin change d'encombrement.
- **Les noms publics ne changent pas.** `tentacle-logo-pirate.svg` est chargé par
  URL depuis les iframes de plugins, y compris des plugins publiés hors du dépôt.
- **`stroke-linejoin="round"` est obligatoire** sur les bras : ce sont des
  polylignes, et le `miter` par défaut projette des piques sur leurs angles aigus.

## Coding Standards

- **300 lines MAX per file** — refactor into sub-components, hooks, or utilities if exceeded
- **Performance**: use `memo`, `useCallback`, `useMemo` to prevent re-renders; lazy load images with shimmer skeletons
- **Video**: direct play first, 30s pre-buffer, automatic transcode fallback on codec errors
- **Un commit par étape** — chaque correctif, extraction ou bump se commite seul, dès qu'il tient debout (`lint` + `typecheck` passés). Jamais un gros commit fourre-tout en fin de chantier : une étape qui se révèle mauvaise doit pouvoir être annulée sans emporter les autres. Commiter ne vaut PAS publier — pas de tag, pas de `push`, pas de dispatch CI sans demande explicite.
- **Le CODE est en anglais, les COMMENTAIRES en français.** Noms de fichiers,
  variables, fonctions, types, interfaces, paramètres, constantes, champs
  d'objets internes : tout en anglais. Commentaires, documentation, titres de
  tests en prose et messages de commit : en français. Un fichier nouveau ne
  déroge jamais ; un fichier ancien encore français se corrige quand on le
  touche vraiment, pas « en passant ».

  ⚠️ **Un nom qui est traversé par une chaîne n'est pas un identifiant.** Ne
  jamais renommer, sous prétexte d'anglais : les clés de stockage
  (`tentacle_*`) et les clés des JSON qu'elles contiennent, les clés i18n, les
  champs d'API HTTP/JSON (Jellyfin comme les nôtres), les types de messages
  Watch Together (`wt:*`), les noms de variables CSS et de jetons de thème, les
  noms de propriétés mpv. Les renommer ne casse pas la compilation — ça casse
  l'exécution, en silence, chez l'utilisateur qui perd ses réglages. Vérifier
  l'usage AVANT de renommer, et laisser un commentaire là où le français doit
  rester (cf. `masquees` dans `railPinning.ts`).

### Linux — le compromis Wayland / X11, et la troisième voie du compositeur

Deux vérités s'opposent, et toute l'architecture du lecteur Linux en découle.

1. **X.Org n'aura jamais de HDR.** Ce n'est pas un manque de temps : il n'y a pas
   de protocole et il n'y en aura pas. Le HDR sous Linux passe par
   `wp-color-management-v1`, un protocole **Wayland**.
2. **Sur Wayland, un client ne place pas ses fenêtres.** C'est une règle du
   protocole — mais elle ne lie que le CLIENT : le **compositeur** place ce
   qu'il veut, et KWin expose une API de script publique. La **colle KWin**
   (`linux/kwinGlue.ts`, script QML : le moteur JS de KWin ne sait pas écrire
   une géométrie — mesuré) cale la fenêtre mpv sous la nôtre et la suit.

D'où les montages, choisis au démarrage (`linux/sessionGraphique.ts`, puis
`detecterFenetrage`) : Wayland + compositeur scriptable (KDE) → **lecture qui
suit la fenêtre** — fenêtrée ou plein écran, comme Windows — et HDR réel, même
fenêtré (mesuré : KWin sert le PQ aux surfaces fenêtrées) ; Wayland sans API de
placement (GNOME, wlroots) → HDR réel, lecture plein écran forcée ; X11 →
lecture fenêtrée à la main, pas de HDR. Un réglage force Wayland/X11 (relance).

Trois conséquences à ne pas défaire :
- **`transparent: true` à la CONSTRUCTION** de la fenêtre (comme macOS, PAS comme
  Windows). Mesuré : posé à l'exécution, la page peint du noir sur la vidéo.
- **`target-colorspace-hint=yes`** sans condition sur Wayland. `auto` n'y décide
  de rien (mpv#16305) et `no` supprime la transmission.
- **Un compositeur est nécessaire sous X11.** Sans composition, X11 ne mélange
  pas le canal alpha et l'overlay masque la vidéo.

Le verdict HDR se lit sur le COUPLE `video-params` / `video-target-params`, jamais
sur l'un des deux : sur un écran laissé en HDR, un contenu SDR sort lui aussi en
PQ. Relevé complet : `docs/LINUX-FENETRE-VIDEO.md`.

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
| Desktop | Electron 43 (Windows, macOS, Linux), libmpv via koffi |
| Mobile | React Native 0.76, Expo 52, NativeWind 4 |
| Backend | Fastify 5, Prisma 6, MariaDB 11 |
| Data | TanStack Query v5 |
| Video | hls.js 1.6 + HTML5 `<video>` (web), react-native-video (mobile/TV) |
| i18n | i18next + react-i18next (FR/EN) |
| Validation | Zod 3.24 |
| TypeScript | 5.7, strict mode, ES2022 target |
