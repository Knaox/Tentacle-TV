# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tentacle TV is a premium multi-platform media client ecosystem for Jellyfin. It features a React web client, a desktop app (Electron on Windows, macOS and Linux, driving a native mpv through koffi), an Expo mobile app, an Android TV app, and a Fastify backend with SQLite (one file, `data/tentacle.db`; MariaDB is only READ, once, to migrate older servers). The project is written primarily in French (comments, context docs, commit messages).

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

# Database (run from apps/backend/) — SQLite, never `prisma db push`
pnpm db:generate      # prisma generate
pnpm db:migration <nom>  # writes the next prisma/migrations-sqlite/NNNN_<nom>.sql (after a schema.prisma change)
pnpm db:studio        # Prisma Studio GUI

# Plugins (run from apps/backend/)
pnpm build:shared-deps  # Download tailwind.js + bundle shared-deps.js (required for plugins)

# Docker
pnpm docker:up        # stacks/tentacle-full, projet tentacle-dev (image publiée)
pnpm docker:rebuild   # construit l'image du dépôt en :local (jamais :dev, publiée) et la lance dans la pile
pnpm docker:reset     # Full teardown + rebuild (volumes included)
pnpm docker:logs      # Tail container logs

# Livrer — voir « Livraison » plus bas. RIEN ne part d'un push :
# tout passe par un déclenchement de workflow, depuis « Tentacle Deploy.html ».
# Seule exception : une poussée sur la branche `dev` publie l'image `:dev`.
gh workflow run server.yml -f channel=store   # le serveur, par exemple
```

> Le remote `production` n'existe plus. `origin` (GitHub) est le seul.

## Livraison (CI)

**Source unique des versions : `versions.json` (racine)** — champs `desktop`,
`tv`, `webos`, `mobile`, `server` (qui est AUSSI la version de l'app Tentacle
Server pour Windows : plus de clé `serverWindows` depuis le 2026-10-12), `minServer` (version serveur minimale exigée
par les clients — avertissement bloquant `useServerCompat.ts` ; au-dessus, les
nouveautés se règlent par les CAPACITÉS du serveur, cf. plus bas). On change la version
À UN SEUL ENDROIT, et c'est la CI qui l'écrit : `.github/scripts/bump-version.mjs`
aligne au passage le `package.json` de la cible. Les **numéros de build**
(CFBundleVersion / versionCode) sont **auto-incrémentés** par la CI (minutes
depuis 2024-01-01 UTC — jamais réutilisés, exigence ASC/Play).

### Un seul geste : la page « Tentacle Deploy.html »

Elle vit **hors dépôt** (Bureau) parce qu'elle porte un jeton GitHub. Elle
déclenche les workflows elle-même par l'API : on choisit une plateforme, des
cibles, un cran, éventuellement une version, et on clique. Elle affiche avant le
clic l'état du contrôle qualité et la taille des notes de version par store.

⚠️ **Son vocabulaire est celui des entrées de workflow** (`targets`, `channel`,
`version`, `promote`) — et `webos.yml`, `server.yml` et `server-windows.yml` n'ont
NI `targets` NI `promote` (`noTargets` / `noPromote` dans la page). Une entrée qu'un workflow ne
déclare pas fait REFUSER le déclenchement (422 « Unexpected inputs provided ») ;
une entrée déclarée que la page n'envoie plus prend son défaut, en silence.
`server.yml` déclare en plus `windows` (booléen, case « Livrer aussi Tentacle
Server pour Windows » de la page : un seul run, image Docker + paquet Windows) ;
`server-windows.yml` déclare aussi `sha`, que la page n'envoie jamais.

### Les trois crans

| `channel` | Ce qui se passe |
|-----------|-----------------|
| `build` | Construit et archive les artefacts. **Rien ne part nulle part.** |
| `test` | Piste Play INTERNE en `completed` (`internal`, `tv:internal` : sans examen de Google, comme TestFlight) · TestFlight distribué au groupe externe · Linux en pré-version · serveur en `:vX.Y.Z` sans bouger `:latest` · webOS sans toucher `webos-latest`, image en `:vS-webos-X.Y.Z` sans bouger `:latest` · Tentacle Server pour Windows dans un VOL de paquet du Store. **Publié, sans aucun geste ensuite.** |
| `store` | Production Play à 100 % · App Store soumis à l'examen avec mise en vente automatique · Microsoft Store (bureau, Tentacle Server pour Windows) · Release GitHub publiée et manifeste d'auto-update patché · `:latest` basculé (par le serveur OU par webOS). **En ligne, sans un clic de plus.** |

**Le cran `dev` (serveur seulement)** : l'image de la branche `dev`, pour qui
veut l'éprouver avant une livraison — `ghcr.io/knaox/tentacle-tv:dev` et
`:dev-<sha8>`, jamais `:latest` ni `:vX.Y.Z`, aucune Release, aucun bump.
SEULE exception au « rien ne part d'un push » : une poussée sur `dev` qui
touche le serveur lance `server.yml` d'elle-même (filtre `paths`, et la
précédente encore en cours est annulée) ; `quality.yml` tourne aussi sur `dev`
et garde ce cran comme les autres. La page de déploiement le propose aussi.

`promote` (le défaut au cran store) reprend **le binaire déjà testé** au lieu
d'en reconstruire un autre. Windows fait exception : le Microsoft Store exige le
paquet à chaque soumission. Une cible sans RIEN de testé pour cette version se
construit : `prepare` le vérifie avant le moindre job (`promote-probe.mjs`), au
lieu de laisser la reprise échouer pendant que Windows part seul au Store.
Sur Play, la reprise part de la piste INTERNE, et d'elle seule
(`PLAY_SOURCE_TRACK`) : plus de piste fermée (décision du 2026-10-20 — son
examen retardait les testeurs de plusieurs jours à chaque version).

**Contrôle avant publication** (`lib/release-check.mjs`, testé hors ligne) :
juste avant le commit de l'édition Play et juste avant l'envoi à l'examen
d'Apple, tout est RELU chez le store et comparé à la livraison — nom de
version, binaire (versionCode ; build TestFlight traité de CETTE version et de
CETTE plateforme), notes recalculées du changelog (reposées si elles
diffèrent), jamais une production Play qui recule. Un écart : rien ne part.
Une version App Store ouverte puis jamais soumise (une 1.10.2) est renommée et
ne part jamais sous son ancien numéro ni avec ses anciennes notes ; une
soumission Apple en cours pour une AUTRE version est un refus, plus un succès
silencieux. Ce que la réécriture d'une piste Play remplace (un brouillon) est
dit dans le journal.

**Apple : le cran test ne touche jamais la version App Store** — il envoie le
build et le distribue sur TestFlight, rien d'autre (`asc-await-build.mjs`). Une
version peut donc se tester pendant qu'une autre est en examen (ASC refuse d'en
ouvrir une nouvelle tant que la précédente n'est pas traitée). C'est le job de
soumission du cran store qui ouvre la version et y rattache le DERNIER build
TestFlight traité de la version (`asc-submit-review.mjs`).

**Hors de `main`, build ou test seulement** : un déclenchement depuis `dev` (ou
toute autre branche) refuse le cran store et l'entrée `version` (le bump se
pousse sur `main`) — action `store-from-main`, dans le `prepare` des six
workflows ; un tag ne vaut le store que s'il pointe sur un commit de `main`.

### Les six workflows

| Workflow | Cibles (`targets`) |
|----------|--------------------|
| `desktop.yml` | `macos` · `windows` · `linux` |
| `mobile.yml` | `android` · `ios` |
| `tv.yml` | `androidtv` · `appletv` |
| `webos.yml` | aucune entrée `targets` — l'IPK ET le client servi sous `/tv` |
| `server.yml` | aucune entrée `targets` — l'image Docker EST le serveur ; `windows` y ajoute le paquet Windows, dans le même run |
| `server-windows.yml` | aucune entrée `targets` — le paquet MSIX de Tentacle Server pour Windows ; aussi RÉUTILISABLE (`workflow_call`, appelé par `server.yml`) |

Les tags `<plateforme>-vX.Y.Z` restent acceptés comme déclencheurs et valent le
cran `store` ; c'est la CI qui les pose quand on demande une version. Un septième
fichier, `server-image.yml`, ne se lance pas seul : c'est le workflow
RÉUTILISABLE qui construit et publie l'image Docker pour `webos.yml` et `server.yml`.

### Le serveur et le client LG — deux moitiés, deux livraisons

L'image Docker porte le **serveur** (backend + client web) ET le **client des
téléviseurs LG**, servi sous `/tv` (`staticClients.ts`). Chaque moitié n'est
livrée que par son workflow, qui reprend l'autre telle quelle :

- **`server.yml`** construit le serveur depuis le commit et **reprend le client
  LG de l'image en service** (`:latest`, épinglée par empreinte) — jamais celui
  du commit. Une livraison serveur ne change plus l'interface des téléviseurs ;
  la Release `server-vX.Y.Z` dit quel client LG elle embarque.
- **`webos.yml`** construit l'IPK et le client, puis **reconstruit l'image** en
  posant ce client sur l'image publiée du serveur de `versions.json` → `server`
  (`:vS`, reprise à l'octet près : pas de nouveau serveur). Cran test : étiquette
  dédiée `:vS-webos-X.Y.Z` ; cran store : `:latest` + Release
  `server-vS-webos-X.Y.Z`. Les Releases webOS partent APRÈS l'image.

Le `Dockerfile` le permet par des **contextes nommés** : ses étapes
`tv-client-build`, `tv-client` et `server` se remplacent ; sans contexte (build
local, `docker compose build`) tout se construit depuis les sources. La décision
(étiquettes, contextes, labels OCI `app.tentacletv.webos-client`, Release) vit
dans `.github/scripts/lib/server-image.mjs`, testée hors ligne, et se rejoue
contre le registre : `node .github/scripts/server-image-plan.mjs plan --mode
webos --channel store --sha $(git rev-parse HEAD)`.

Gardes propres à ce couple :
- webOS au cran store **refuse** si `:latest` n'est pas déjà le serveur de
  `versions.json` (il mettrait en service un serveur seulement testé) ; aussi si
  `minServer` dépasse ce serveur, ou si `:vS` n'existe pas. Pré-vol AVANT le bump.
- **La bascule de `:latest` est un compare-and-swap** (relecture de son empreinte
  juste avant d'écrire), dans un groupe de concurrence commun
  (`server-image-latest`) : serveur et webOS lancés ensemble ne s'écrasent plus.
- Revers : un build `apps/tv-webos` cassé ne bloque plus le serveur, et ne se voit
  qu'à la livraison webOS — le cran `build` de `webos.yml` le vérifie.

### Tentacle Server pour Windows — un serveur déjà livré, dans un paquet du Store

**La version de l'app EST celle du serveur** (décision du 2026-10-12) :
`versions.json` → `server`, paquet `X.Y.Z.0`, tag `server-windows-vX.Y.Z`
(posé en fin de run au cran store), notes = CELLES DU SERVEUR, bloc
`## [X.Y.Z]` de `changelogs/server.md` (`WINDOWS_NOTES`), mesuré contre les
1 500 caractères par langue du Store — plus de fichier à part (voir
« Changelogs »). Plus de clé `serverWindows`. Seule exception, la **1.0.0**, construite à la main hors
workflow (paquet `1.0.0.0`) : tout serveur livré depuis la dépasse, et le Store
exige un paquet strictement croissant. **`server-windows.yml` ne bumpe rien** :
son entrée `version` n'est qu'une garde (≠ `server` au commit figé → refus).
Décision : `lib/server-windows.mjs`, testée hors ligne, rejouée par
`node .github/scripts/server-windows-plan.mjs plan --channel store --sha $(git
rev-parse HEAD) [--version X.Y.Z]`.

- **Un seul run : image Docker + paquet Windows.** `server.yml` avec l'entrée
  **`windows`** (case de la page) : au cran test ou store SEULEMENT (refusé
  avant le bump au cran build ; une poussée sur `dev` n'a pas d'entrée), il joue
  le pré-vol de l'app (variables, bloc `## [S]`), publie l'image, puis — image
  publiée, `:latest` basculé au cran store — APPELLE `server-windows.yml` comme
  un job (`workflow_call`, `secrets: inherit`, sur le modèle de
  `server-image.yml`) au même cran, à la même version, avec `sha` = son commit
  figé (le bump) : pas de second bump. Le job d'appel donne `contents: write`
  (tag), `actions: read`, `packages: read` — plafond des jobs appelés.
  Appelé, `github.*` est celui de server.yml (jamais le bump) : seul
  `inputs.sha` fait foi, aucune condition sur `github.event_name`, et la
  concurrence (`release-server-windows`) est au niveau du JOB qui soumet.
- **Relivrer l'app seule** : `server-windows.yml` garde `workflow_dispatch`
  (page : `channel`, `version`) et le tag `server-windows-v*`, sur le serveur
  déjà livré.
- **Les gardes de webOS** : `:vS` doit exister ; au cran store, `:latest` doit
  DÉJÀ être ce serveur ; `minServer` ne dépasse pas `server`. Pré-vol avant le
  moindre build.
- **Le client LG n'est jamais celui du commit** : extrait de `:latest` s'il sert
  ce serveur, sinon de `:vS` (empreinte épinglée, `docker create` + `cp`). Le
  serveur, lui, se construit depuis le commit (moteur Prisma de Windows) ; un
  écart avec le commit qui a publié `:vS` avertit, sans bloquer.
- **Cran test = un VOL de paquet** (`msstore-submit.mjs` + `FLIGHT_ID`), jamais
  la fiche. Variables du dépôt `SERVER_WINDOWS_STORE_ID` et
  `SERVER_WINDOWS_FLIGHT_ID`, plus l'identité de Partner Center
  (`SERVER_WINDOWS_IDENTITY_NAME`, `SERVER_WINDOWS_PUBLISHER`,
  `SERVER_WINDOWS_PUBLISHER_DISPLAY_NAME`) ; absentes, test et store refusent
  avant le moindre build (et `server.yml` avant son bump si `windows` est
  coché), le cran build reste possible (identité de développement).
  Mêmes secrets `PARTNER_*` que le bureau.
- **L'assemblage** est `pnpm --filter @tentacle-tv/server-windows assemble --
  --out <dossier> --version X.Y.Z.0 --tv-client <dossier>` : un dossier prêt
  pour `makeappx pack /nv`, manifeste versionné compris (le workflow le vérifie).
  `SERVER_WINDOWS_JELLYFIN_INSTALLER=off` (variable du dépôt) passe
  `--no-jellyfin-installer` : le paquet ne propose plus d'installer Jellyfin,
  seulement jellyfin.org puis la détection (si le Store refuse, règle 10.1.5).
- **MinVersion 19041** (Windows 10 2004) : l'hôte est lancé par
  `uap10:Parameters`, qui n'existe pas avant.

### Ce qui garde les livraisons

- **`.githooks/pre-push`** refuse un push dont le typecheck ou les tests
  échouent, AVANT qu'il parte. Il ne contrôle que les paquets touchés et ceux
  qui en dépendent. Il s'active seul (`pnpm install` pose `core.hooksPath`).
- **`quality.yml`** rejoue le même contrôle sur GitHub, et **aucun workflow de
  livraison n'accepte de tourner sans son feu vert** sur le commit visé. Les
  commits que la CI pousse elle-même (manifestes, bump) n'ont jamais de run :
  s'ils ne touchent que des fichiers neutres, ils héritent du verdict de leur
  parent (`.github/scripts/quality-target.mjs`, qui tient la liste fermée). Un
  bump `desktop` n'en fait pas partie — `registry.test.ts` lit cette clé.
- **Le pré-vol** (`check-changelog.mjs`) exige le bloc `## [X.Y.Z]` de la version
  livrée AVANT le moindre build. Un bloc manquant ne donne plus une publication
  silencieusement sans notes.
- **Le SHA est figé** par le job `prepare` : tous les jobs d'un run lisent le
  même commit. Une retouche de changelog poussée pendant un run ne part pas.

### Changelogs

`changelogs/{desktop,tv,server,mobile,webos,server-webos}.md`, blocs `## [X.Y.Z]` avec
`### FR` / `### EN`. Limites appliquées (`lib/changelog.mjs`) : ASC 4000,
MS Store 1500, Play 500 **caractères Unicode**. Les blocs par canal
`## [mac-X.Y.Z]` et `## [win-X.Y.Z]` remplacent le bloc nu pour ces cibles-là
(bureau seulement). `CHANGELOG.md` racine = archive pure.

**Notes CUMULÉES, sans retoucher un changelog** : une boutique en retard reçoit
aussi les nouveautés des versions qu'elle n'a jamais servies — macOS 1.28.1
face à un Mac App Store en 1.25.3 emporte les blocs 1.25.4 → 1.28.1, du plus
récent au plus ancien (la coupe à la limite garde la version livrée en tête).
La version servie vient d'App Store Connect (`liveVersion`, macOS/iOS/tvOS),
de la piste de production lue dans l'édition Play, ou de
`updates/store-versions.json` (Microsoft Store `NOTES_SINCE_BLOCK: win`, Linux
`--since-block linux`, et la fenêtre de mise à jour de l'app). Règle :
`lib/changelog.mjs` → `notesVersions` / `extractCumulative`, testée hors ligne.
Seul le bloc de la version livrée est EXIGÉ (pré-vol) ; pour Apple, les
caractères refusés d'un bloc sauté sont retirés, jamais envoyés.

**Tentacle Server pour Windows n'a PAS de changelog à lui** (décision du
2026-10-12) : ses « Nouveautés » sont LES MÊMES que celles du serveur, le bloc
nu `## [S]` de `changelogs/server.md` — jamais de `## [win-S]` dans ce fichier,
un seul texte. Quand l'app est livrée (`server.yml` + `windows`, ou
`server-windows.yml` seul), le pré-vol mesure ce bloc contre la limite du
Microsoft Store (1 500 par langue) et dit de combien la coupe à la puce va
mordre ; un bloc qui dépasse avertit, il ne bloque pas. Le texte de la 1.0.0
(soumise à la main) vit dans `docs/server/windows-store-listing.md`.

**Une livraison webOS demande DEUX blocs de la même version webOS** :
`changelogs/webos.md` (Releases webOS : coquille et client) et
`changelogs/server-webos.md` (Release du serveur reconstruit : ce qui change pour
la TV LG, dit à qui tire l'image). Fichier à part exprès : un `## [1.1.0]` de
`server.md` serait le vieux serveur 1.1.0, et le pré-vol s'en contenterait.

### Deux fiches partagées, deux pièges

- macOS, iOS et tvOS partagent la fiche App Store Connect `com.tentacle.mobile` :
  toute recherche de build exige le triple filtre `version` + `preReleaseVersion.version`
  + `preReleaseVersion.platform`.
- Android TV et Android mobile partagent la fiche Play `com.tentacletv.mobile` :
  les pistes par form factor sont PRÉFIXÉES dans l'API (`tv:internal` ≠ `internal`, la
  piste partagée du téléphone, qui refuse un AAB exigeant leanback), le
  versionCode TV vaut `2e9 + build`, et les deux workflows partagent un groupe de
  concurrence — deux éditions Play concurrentes s'invalident l'une l'autre.

## Architecture

### Monorepo Structure (pnpm workspaces)

```
apps/web/        → React 19 + Vite 6 + Tailwind CSS (main web client)
apps/desktop-electron/ → Electron (Windows, macOS, Linux — same web build, same libmpv)
apps/mobile/     → Expo 52 + React Native 0.76 (iOS/Android)
apps/tv/         → React Native (react-native-tvos) for Apple TV and Android TV
apps/backend/    → Fastify 5 + Prisma 6 + SQLite

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
- **Database**: SQLite via Prisma ORM (`data/tentacle.db`), schema at `prisma/schema.prisma`, versioned migrations in `prisma/migrations-sqlite/` — see « Base de données » below

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

## Capacités du serveur — le serveur décide de ce qui s'affiche

**Un client n'affiche JAMAIS une option, une section ou une fonction que son
serveur ne sait pas faire.** Un appareil à jour face à un serveur plus ancien
n'en voit rien et n'en subit aucun effet. Le serveur le DÉCLARE
(`GET /api/config` → `capabilities`) ; les clients ne lisent que cette
déclaration. **Jamais un `if (version >= x)`**, jamais un 404 interprété en
« serveur trop ancien » pour une fonction nouvelle.

- **Le contrat** : `packages/shared/src/serverCapabilities/serverCapabilities.ts`,
  liste FERMÉE clé → version du serveur qui l'apporte, recopiée octet pour
  octet dans `apps/backend/src/serverCapabilities/` (`capabilitiesMirror.test.ts`).
  Les clés traversent le réseau : elles ne se renomment jamais.
- **Un serveur qui ne déclare rien** (≤ 1.23.x) vaut les clés dont `since`
  est atteint par sa version — aujourd'hui aucune : comportement d'avant,
  sans erreur. Dès qu'il déclare, SA liste fait foi.
- **Une seule porte côté clients** : `useServerCapability("…")`,
  `useServerCapabilities()` et `<ServerCapabilityGate capability fallback>`
  (api-client, sur la requête `["app-config", serveur]` déjà en cache). Rien
  tant que la configuration n'a pas répondu ; `fallback` (le comportement
  d'avant, une redirection) une fois l'absence établie. Web, bureau, mobile,
  TV, webOS : la même. Une règle PURE (shared, tv-core) reçoit
  `capabilities: ReadonlySet<ServerCapability>` en entrée — ex.
  `buildAdminAttention`, `deliveryOf` —, l'adaptateur la lit par le crochet.
- **Capacité ≠ réglage.** Ce que l'administration peut COUPER (Famille, ses
  invités) reste dans `features` ; une capacité dit ce que le CODE du serveur
  sait faire. Une fonction purement client (fréquence d'écran, lecteur) n'a
  pas de clé. Une fonction d'EXTENSION se lit sur le contrat qu'elle déclare
  (`/api/plugins/active` → `titles`, `search`… : `titleProvider`), jamais sur
  son identifiant.
- **L'avertissement** : sous `minServer`, « Serveur à mettre à jour »
  (`serverUpdate`) est bloquant et ne se masque pas ; au-dessus, s'il manque
  une capacité connue du client, une invitation (`serverNews`, « Pour profiter
  des dernières nouveautés… »), masquable jusqu'aux prochaines nouveautés
  (`notices/serverUpdateNotice.ts`).

**Nouvelle fonction qui dépend du serveur — mode d'emploi :**
1. Ajouter SA clé dans `serverCapabilities.ts` (shared) avec la version du
   serveur qui la livrera, puis `cp` vers le backend (le test miroir le tient).
2. Le serveur la déclare d'office (`declaredCapabilities.ts`) — rien à faire
   tant que la route existe dans ce code.
3. Chaque client garde l'entrée (bouton, section, route, requête) par
   `useServerCapability` / `ServerCapabilityGate` — une requête vers une
   route nouvelle prend `enabled: useServerCapability(…)`, et son `refetch`
   manuel aussi.
4. Un test face à un serveur qui ne déclare rien : la fonction est absente,
   sans erreur.

## Marque — le logo ne se dessine qu'à un seul endroit

`brand/` est la source unique. Rien de ce qui en dérive ne se retouche à la main :

```bash
python3 brand/generate-svg.py brand      # les 21 SVG + 3 modules TS
python3 brand/generate-icons.py --write  # les binaires (aperçu sans --write ;
                                         #  un mot en plus = filtre de chemin)
pnpm --filter @tentacle-tv/tv-webos icons  # webOS, à part — voir plus bas
```

`generate-svg.py` écrit aussi les constantes consommées par les clients :
`apps/web/src/components/ui/tentacleArmPaths.generated.ts` et
`tentacleArt.generated.ts` pour la TV et le mobile. Les bras sont des spirales
échantillonnées — elles ne se recopient pas à la main, et trois copies auraient
divergé. Côté natif les `dasharray` sont en unités RÉELLES de tracé :
`pathLength` n'existe que dans le rendu web de react-native-svg.

Cinq pièges déjà payés :

- **Windows (MSIX) : jamais un visuel sans ses variantes `unplated`, jamais
  sans `resources.pri`.** Sans elles, Windows pose l'icône réduite sur une
  plaque à la couleur d'accent — la « bordure » relevée sur le Store
  (2026-10). Les deux paquets (bureau, Tentacle Server) reçoivent la mascotte
  seule sur transparent, à toutes les échelles et tailles cibles
  (`brand/windows.py`) ; l'assemblage construit l'index
  (`.github/scripts/msix-resources.mjs`). Tentacle Server a son PROPRE logo
  (`logo-server.svg` : la mascotte + un badge « serveur », `brand/server.py`).

- **webOS a son propre script** (`apps/tv-webos/scripts/icons.mjs`) et
  `generate-icons.py` l'ignore volontairement : il faut un maître de 5200 px
  réduit en Lanczos, un fond opaque calibré sur `iconColor`, et un splash qui ne
  soit pas noir. Son `SUBJECT` se REMESURE si le dessin change d'encombrement.
- **Les noms publics ne changent pas.** `tentacle-logo-pirate.svg` est chargé par
  URL depuis les iframes de plugins, y compris des plugins publiés hors du dépôt.
- **`stroke-linejoin="round"` est obligatoire** sur les bras : ce sont des
  polylignes, et le `miter` par défaut projette des piques sur leurs angles aigus.
- **L'Apple TV se compose dans `brand/tvos.py`** : l'icône en COUCHES (fond,
  lumière, poulpe, bras avant — cadrée à la parallaxe mesurée), son Top Shelf,
  et le logo de lancement, qui reproduit la première image de l'app
  (`BootView`) : les deux se retouchent ensemble. Ne régénérer que
  `generate-icons.py --write apps/tv/ios` ; l'app tvOS se reconstruit.

**Apple TV : aucun logo dans l'interface** (choix de l'utilisateur,
2026-10-02, après un coin « mal intégré ») — ni coin, ni tête de rail, ni
marque de héros. La mascotte n'y paraît qu'en ILLUSTRATION d'un état
(`BrandMark` : démarrage, jumelage, erreurs, hors ligne, À propos) ;
l'identité, c'est l'icône en couches, le Top Shelf et le violet → rose en
touches. Détail : `docs/TV-REFONTE.md`, « Le logo dans l'app : aucun ».

## Ouverture du démarrage (Apple TV, Android TV, mobile, iPad) — l'écran du poulpe EST le premier écran

À CHAQUE démarrage à froid, d'elle-même (jamais l'attente d'un geste), QUEL QUE
SOIT LE PREMIER ÉCRAN — accueil, « Qui regarde ? » et son PIN, jumelage, barre,
code PIN conseillé, photo, hors ligne, migration, accès suspendu —, le logo
s'assemble pendant que l'app charge, appuie sur lecture (« ta »), son écran
s'allume (« dum ») sur cet écran-là, puis la caméra plonge dedans jusqu'à
l'échelle 1 (conception : page `/survey/` du site ; règle de Damien du
2026-10-18, après « Chambre » où, réservée à l'accueil, elle ne se jouait jamais
sur une TV à profils). Carnet : `docs/OUVERTURE.md`.

- **Une seule fois par processus** (tv-core `bootIntroOnce`) : ni après profil,
  jumelage ou PIN, ni au retour d'arrière-plan, ni à un changement de profil, ni
  à un rechargement de l'arbre ou du JavaScript — mémoire NATIVE
  (`TentacleBootSound.claimIntro`). Décidée au montage de l'app.
- **Le pur est partagé** : `@tentacle-tv/shared/brandIntro` (courbes, géométrie
  TIRÉE des constantes générées du logo — jamais un SVG relu —, caméra,
  chorégraphie, attente, partition du son, quand la jouer, quand partir ;
  tv-core `boot/` le réexporte) ; la synthèse Web Audio à part
  (`…/brandIntro/synth`). La VUE et le déroulé : `@tentacle-tv/brand-intro-native`,
  les mêmes pour la TV et le mobile (chaque app passe son dégradé et sa découpe).
- **Mobile, iPad** (`apps/mobile/src/bootIntro/`) : le logo garde SES proportions
  (jamais étiré) ; seule la fenêtre allumée dans sa vitre prend le rapport de la
  fenêtre (`introLitWindow`), le logo de départ se cadre dans la zone
  sûre ; réglages d'appareil « Animation d'ouverture » et « Son au démarrage » ;
  les modales du lancement attendent `useBootIntroLanded()` ; le son natif est
  celui de la TV, compilé tel quel par le projet mobile.
- **Aiguillage par le trait `brandIntro`** (vrai sur tvOS et Android TV depuis
  le 2026-10-19 ; sans lui, `BootView`). Jamais avec le mouvement réduit. Elle ne renonce
  jamais ; le premier écran pas prêt (il le dit à la porte,
  `useReportScreenToBootIntro` : accueil, « Qui regarde ? ») : le poulpe attend
  sur son bouton lecture (8 s au plus). Mobile : route d'arrivée décidée avant
  la plongée (`mobileBootArrival` : jamais une route qu'une garde remplace) ;
  « Qui regarde ? », premier lancement, migration, accès suspendu nés pendant
  l'ouverture se rendent DANS l'écran (`BootAwareModal`, `BootAwareOverlay`),
  jamais en `Modal` par-dessus.
- **L'app est montée DANS l'écran** (`IntroScreenPlane`) et n'en
  change jamais d'arbre : à l'arrivée, identité et découpe retirée. Rien que des
  transformations et des opacités, horloge Reanimated sur le fil d'interface,
  tableaux de tv-core (`sampleIntro`), plaques 5× pour la plongée (`plateSwapAt`).
- **Le son est un FICHIER DÉRIVÉ** de la synthèse (`pnpm --filter
  @tentacle-tv/tv sound:intro` : Chrome sans tête, `OfflineAudioContext`, crête
  −9 dBFS, AAC) — jamais retouché ; joué par `TentacleBootSound.m`
  (AVAudioPlayer, `playAtTime:` à l'heure de l'image, catégorie « ambient » :
  une musique en cours n'est pas coupée). Android : le MÊME fichier, posé tel
  quel dans les assets de l'APK (`build.gradle`), `boot/BootSoundModule.kt` —
  un flux ouvert d'avance (silence) où le fichier s'écrit au numéro d'image de
  la SORTIE (`getTimestamp`), sans focus audio. La sortie d'Android écrit loin
  devant ce qui sort (Shield ≈ 360 ms) : le natif la mesure et l'horloge de
  l'image demande le son d'autant plus tôt (tv-core `bootSoundLeads`) — sinon
  le début du fichier, « ta » compris, est sauté. Réglage d'appareil « Son au
  démarrage » (`tentacle_tv_boot_sound`). Aucune capacité serveur.
- **L'écran de lancement est l'encre seule** (`BOOT_INK`, #0D0B13) : la première
  image de l'ouverture ; sans elle, la mascotte n'y paraît que si le démarrage traîne.
- **Téléphone Android** : jamais le sombre forcé (`android:forceDarkAllowed="false"` ;
  ColorOS blanchissait la vitre sombre de l'écran du poulpe) ; le son se demande
  `BOOT_SOUND_MOBILE_BRIDGE_MARGIN_MS` plus tôt (le fil JS du démarrage le retarde),
  une fois préparé ; le vibreur ne le tait pas, seul le mode silencieux.

## Avatars — une troupe dessinée, envoyée comme photo Jellyfin

La galerie des photos de profil (web, bureau, fenêtre étroite : `profiles/avatarGallery/`,
ouverte par « Changer la photo ») propose 36 PERSONNAGES, chacun avec son nom et son histoire,
et garde « Importer une photo » en tête. **Aucune image n'est générée par une IA** : chaque
personnage est dessiné dans `brand/avatars/characters/<id>.py` et imprimé en risographie par
`brand/avatars/generate.py` (rendu déterministe), qui écrit `apps/web/public/avatars/` — rien
ne s'y retouche à la main (`brand/avatars/README.md`, règles de dessin comprises).

- **Choisir un personnage = envoyer son image comme photo Jellyfin du compte**
  (`useAvatarUpload`), exactement comme une photo importée : elle suit le compte sur la TV, le
  mobile et tout client Jellyfin. **Aucune capacité serveur.**
- Catalogue (ordre, collection, couleur d'attente, tempérament au survol) :
  `packages/shared/src/avatars/avatarCatalog.ts` ; noms et histoires : espace i18n `avatars`.
  Les identifiants nomment des fichiers et des clés : ils ne se renomment jamais.
- **Les invités de la Famille** (serveur 1.30.0, capacité `family.guestPhotos`) : le SERVEUR pose
  leur photo (`setGuestPhoto`, mêmes droits que leur PIN), depuis Réglages › Famille, ou pendant
  la session de profil de l'invité sur le bureau, par la session PERSONNELLE de l'appareil
  (`PickerProfileDto.photoEditable`). La galerie vise une cible (`useAvatarTarget` : compte ou
  invité). Un membre change la sienne depuis ses appareils ; sur la TV, une session de profil (membre ou
  invité) pose SA photo, catalogue seulement, par le proxy (capacité `avatars.devicePhoto`,
  `deviceWrites.ts`, galerie `redesignWiring/avatars/`). La photo d'un invité posée par un AUTRE
  (propriétaire, parent) reste la règle de la Famille (`setGuestPhoto`).
- **Invitation unique** (règle partagée `shared` › `avatarInvite`) : un SUJET sans photo — le
  compte en session personnelle, ou l'invité habillable de la session de profil —, en ligne, une
  fois par sujet et par appareil (`tentacle_avatar_invite_seen`) : la galerie elle-même, APRÈS
  que la porte des nouveautés a tranché (`useWhatsNewGate` → `decided`), jamais par-dessus un
  autre recouvrement de démarrage ; ouverte, elle suspend la pop-up de mise à jour.
- **Mobile** (`apps/mobile/src/avatars/`) : la même galerie en feuille (toucher désigne, toucher encore
  choisit), images EMBARQUÉES (copiées par `generate.py`, module de `require` généré) avec repli sur
  `/avatars/<id>.webp` du serveur ; envoi en WebP (accepté par Jellyfin 10.11). L'invitation attend le
  registre des recouvrements du démarrage (`src/startup/` : chaque hôte y dit `pending`, `active` ou
  `quiet`) ; sa clé est dans la liste des clés préchargées de `RNStorageAdapter`.

## Cartes — un seul survol, trois variantes

Toute carte d'un titre de la bibliothèque, sur toutes les plateformes, rend le
MÊME modèle, dans `packages/shared/src/utils/` :

- **au repos**, les marqueurs (`cardMarkers.ts` → `useCardMarkers`) : note
  globale et note perso en bas à gauche, pastille Ma liste · favori · vu en
  haut à droite, barre de progression commune ;
- **au survol**, `cardOverlay.ts` (`resolveCardOverlay` ; `cardActionEntries`
  pour une feuille ou un panneau rendus depuis une liste) :
  Lire / Reprendre, la note, puis Ma liste → favori → vu (l'ordre de la
  pastille), puis les extras — hors ligne, fiche, « Ne plus me proposer ».
  Trois variantes, pas une de plus : `poster` (2:3, le clic ouvre la fiche),
  `landscape` (16:9, le clic lance la lecture), `reco`. Un titre lu sur le
  disque passe `local: true` ; un titre hors bibliothèque (Vigie) a son
  pendant, `externalCardOverlay.ts`. Sur Apple TV, un titre ABSENT (saga d'un
  film, rangée « À demander » de la recherche, recommandation hors
  bibliothèque de « Pour vous » et des rangées reco de l'accueil) est une carte grisée
  (`card.absent`, `AbsentArtwork`) — en couleurs au focus, et dès le repos pour
  une recommandation (`absent.inColor`), le badge disant seul l'absence ; elle a
  son aperçu au focus (`trailer` par la clé TMDB, `absentTrailerOf`) ; sa demande ne passe que par
  `redesignWiring/vigie/`, derrière la garde `useVigieGate` — sans elle,
  « pas disponible », et aucune trace de demande.
- **rien au centre de l'image**, sur aucune variante ni plateforme : le clic
  de la carte fait déjà l'action principale. L'action primaire est le PREMIER
  bouton du plateau (`CardTrayPrimaryButton`) — « Lire » discret (ton
  `quiet`) là seulement où le clic ne lit pas (`playInTray` : affiche,
  reco ; jamais la vignette 16:9, qui EST la lecture), « Demander » (ton
  `brand`) sur une carte Vigie. Une série de la bibliothèque à qui il manque
  des saisons, DANS LA RECHERCHE (`SeriesGapsScope`, contrat `titles.gaps`,
  une question par page), offre « Demander » au ton `brand` JUSTE APRÈS
  « Lire » (`overlay.request`) — et « 2 saisons à demander » sous l'affiche ;
  une feuille le met sous la lecture. Tout ouvre la feuille des saisons
  (modèle `seasonPick`, shared) : ce que la bibliothèque a y dit « Dans la
  bibliothèque », jamais à cocher. Une feuille (appui long, télécommande)
  remplace la carte : elle garde « Lire » en tête dans tous les cas. Le
  plateau se resserre sur une affiche étroite (`TRAY_SIZE`) sans jamais
  déborder, et garde des centres à 24 px au moins
  (espacement WCAG 2.5.8) : cinq boutons au plus sur une affiche — une reco
  n'offre donc pas « garder hors ligne », une série à compléter non plus.

Seule l'ENTRÉE change : la souris sur le web et le bureau (`CardHoverOverlay`,
monté au survol), l'appui long sur le mobile et le miroir (`CardSheetScope` /
`CardSheetProvider` → la feuille), l'appui MAINTENU sur TV. **Sur Apple TV et
Android TV, rien ne se fait sur la carte** (refonte, `apps/tv/src/redesign/`,
la MÊME sur les deux depuis la bascule d'Android du 2026-10-05) : au focus, elle
grandit et garde ses marqueurs — note, épingle Ma liste · j'aime · vu,
progression — et dit sous sa légende, discrète, « Maintenir OK : plus
d'options » (`CardFocusFooter`, sur toute carte qui s'ouvre par l'appui maintenu
: c'est le seul chemin vers ses actions ; le nom de la touche vient de la table
de la plateforme, tv-core `remote/bindings/hints`). Dans une RANGÉE QUI S'OUVRE
(Accueil, « Pour vous », bibliothèques, Ma liste, Mes favoris — voir « La carte
qui s'ouvre » plus bas), elle s'ouvre en 16:9 et ses détails disent « OK : ouvrir
la fiche · Maintenir OK : plus d'options ». L'appui maintenu ouvre le GRAND
PANNEAU centré (`screens/sheet/ActionSheetView`, câblé par
`ActionSheetRedesign`) : l'en-tête, les étoiles en grand, l'ÉCHELLE HORIZONTALE
de la note (`RatingRuler` : GAUCHE / DROITE, les valeurs du bureau —
demi-étoiles, 1 à 10 — défilent de droite à gauche, la valeur visée au centre,
« Retirer la note » au bout), puis les pictos dans l'ordre du modèle partagé —
la lecture ou « Demander » au dégradé de marque, Ma liste → favori → vu, « Plus
d'infos » sur TOUTE carte de la bibliothèque (ajout du salon, `sheetRows`,
jamais dans le modèle partagé), « Ne plus me proposer ». Le focus y ENTRE sur
l'échelle, PRÉ-FOCALISÉE à la note posée, sinon à 5/10 (`RATING_ENTRY`), une
fois la note connue ; dans la `Modal`, aucune préférence de focus n'est honorée
: les autres cibles restent infocalisables jusqu'au premier focus
(`useChoiceEntry`), et la garde anti-clic fantôme couvre l'échelle (le panneau
s'ouvre sous un OK encore enfoncé). « Noter » de la fiche ouvre le même panneau,
réduit à la note. Un seul crochet d'actions (`useCardActions`,
`apps/tv/src/redesignWiring/cards/`), jamais une copie. Les étoiles ENTIÈRES ne
valent plus que pour webOS (`CardActionSheetTv`), pas encore porté, qui garde
les marqueurs au focus. Sur tvOS, la cible d'une carte (`CardShell`, `FocusTarget form="card"`) couvre son
image ET sa légende mais ne porte que l'IMAGE ; la légende est dessinée avant
elle, dessous, hors de son sous-arbre. Jamais un frère qui dessine PAR-DESSUS la
cible : tvOS ne focalise jamais un élément RECOUVERT par ce qui dessine — la
recherche géométrique ne le propose plus (régression payée : plus une carte
atteignable). Seule l'image suit le pouce (parallaxe native de la vue
focalisée), la légende ne s'incline jamais. État et gestes : `useCardToggles`,
`useCardRatingTarget`, `useCardFace` (api-client). Une feuille qui garde un
instantané de sa carte lit la fiche `["item", id]`, que les mutations patchent.

**Qualité au focus (Apple TV).** Au focus d'une carte, la qualité du titre se
pose aussitôt si elle est CONNUE ; sinon, le titre se LIT après 300 ms de focus
(aucune requête pendant un défilement) et la qualité paraît dès la réponse. Rien
de ce qui se révèle au focus n'attend (tv-core `focus/focusReveal`). Elle se pose
DANS l'image, en bas à droite, sur la rangée de la note
(`CardQualityBadges`, monté avec l'habit du focus — rien au repos) : « 4K ·
VISION · ATMOS », ce qui tient à côté de la note, le 4K d'abord. Dans le
sous-arbre de la cible, comme la note : jamais par-dessus. La règle est partagée
(`qualityBadges.ts` : 4K, UNE plage Dolby Vision › HDR10+ › HDR10 › HDR, Dolby
Atmos dès qu'UNE piste le dit, jamais déduit du codec) ; la fiche Apple TV dit la
même chose en noms entiers. Une liste sans les flux (les grilles : jamais
`MediaSources` dans leurs requêtes) lit son titre au focus, un à la fois
(`createQualityBadgeStore`, tv-core) ; une série, rien.

Jamais une lecture directe de `UserData` dans une carte, jamais un plateau, une
coche ou une barre recopiés : une nouvelle carte ou une nouvelle action passe
par le modèle, et toutes les plateformes la reçoivent.

Une seule copie tolérée, faute de pouvoir importer : la page de Vigie (dépôt
Tentacle-Plugin-Seer, bundle à part dans son iframe ou sa WebView) rend le
JUMEAU de ce survol, `src/components/ui/PosterHover.tsx`. Tout changement de
ton, d'ordre ou de gabarit du plateau s'y reporte. Sur les cartes du cœur,
« Demander » n'existe que si le Vigie installé déclare le contrat `titles` :
un Vigie trop ancien les laisse sans « + », sans la moindre erreur — vérifier
la version déployée (`data/plugins/installed.json`) avant de conclure au bug.
**Exception assumée, Apple TV :** les demandes en cours (routes `titles.access`
et `titles.mine` du contrat), « Demander » un titre absent — collection d'un
film, rangée « À demander » de la recherche, recommandations hors
bibliothèque (`useRecoAbsent` : à leur place dans l'ordre servi,
`tvRecoShelves(…, { external })`, panneau avec « Ne plus me proposer »,
carte tenue tant qu'une feuille est ouverte), feuille des saisons
(`titles.state`, `titles.request`, `titles.seasons`) — et les saisons
MANQUANTES d'une série de la bibliothèque — en tête de la rangée « À
demander » de la recherche, en onglets grisés au bout de la bande des
saisons de la fiche (`titles.gaps`) — sont les SEULES fonctions de Vigie que
le cœur intègre nativement, toutes dans `redesignWiring/vigie/`. Une demande
DU COMPTE s'y montre partout de la même façon (`ArrivalArtwork`) : l'affiche
grise reprend sa couleur au prorata de l'avancement, le camembert au centre,
en direct — relue toutes les 10 s seulement tant qu'un de ses titres avance
à l'écran (`liveRequests`, un battement par liste), jamais autrement.
« Mes demandes » (rail, fenêtre) ne montre que les demandes faites DEPUIS UNE
TV, quelle qu'elle soit : chaque demande d'une TV porte l'origine « tv » et
sa plateforme (tv-core `tvTitlesGate` → `tvRequestOrigin`, gardée par Vigie),
la liste se lit par `titles.mine?origin=tv` ; les cartes, elles, disent
l'état de TOUTES les demandes du compte. Un Vigie d'avant l'origine (< 1.22)
ignore le filtre : liste entière, comme avant. Les saisons s'y nomment dans
les mots de l'interface (« Saison 3 », « Spéciaux », et leur vrai nom —
tv-core `seasonTitle`) ; le « + » d'un onglet grisé de la fiche demande SA
saison, sans feuille, et garde le focus ; dans la feuille des saisons, OK
coche et Lecture/Pause demande (tv-core `seasonsShortcut`), dit au pied de
la feuille.
Toute fonction de Vigie sur la TV passe par `useVigieGate` : serveur ou Vigie
trop anciens, Vigie éteint, compte bloqué dans Vigie (le compte de
démonstration de la revue Apple), profil INVITÉ de la Famille sans le droit
« Peut demander des films » (`guestRights.requestTitles`, réglé par le
propriétaire, proposé seulement si `features.family.guestRequests`) → aucune
trace. Un invité qui a le droit demande à SON PROPRE NOM (`profileMayRequest`,
tv-core) ; un membre garde son propre Vigie.

## Recommandations — le goût, et le retrait jamais sous le curseur

- **Ma liste n'est pas un goût.** Un titre seulement listé (ni vu, ni aimé,
  ni noté) est un POTENTIEL (`services/reco/potentials.ts`,
  `taste_profiles.potentials`) : aucun poids, aucune graine. Un même
  « j'aime » (cœur, like Vigie, like d'Affiner) ne compte qu'une fois.
- **Le like d'Affiner EST le cœur de la bibliothèque** — tout de suite, ou à
  l'arrivée du titre (`watchlist_pending`, drapeau `favorite`).
- **Un titre jugé sort de « Pour vous » au LÂCHER de sa carte** : fin du
  survol de sa RANGÉE (web), feuille refermée (mobile, miroir, TV). Jamais de
  retrait direct du cache reco pour un geste de carte : passer par
  `useHeldRecoItems` / `useRecoCardHold` (`reco/recoRetirement.ts`). Seul
  « Ne plus me proposer » part tout de suite. Détail : `docs/RECO-POUR-VOUS.md`.
- **Sans clé TMDB, la reco n'est pas activée** (état `disabled`,
  `tmdbConfigured: false`, qui prime sur le réglage du compte) : « Pour vous »
  le dit sans reproche, le bouton vers `/admin/metadata#tmdb` (la cible du
  tableau de bord) pour un administrateur en session personnelle seulement,
  les mots seuls sur TV et mobile. Poser la clé l'active pour tous (§ 6).
- **« Tendances actuelles » en TÊTE de « Pour vous »** (serveur 1.31.0,
  capacité `reco.trending`) : les tendances TMDB de la semaine, films et
  séries, dans l'ordre de TMDB — JAMAIS passées par le goût ni les
  statistiques (`services/reco/trendingHead.ts`, contrairement à la rangée
  `trending` filtrée par `gateGlobalRow`). Servie DANS la page, au moment de
  la requête, à qui la demande (`?trendingNow=1`, rangée `trendingNow`) — et le
  client ne la demande que si l'app sait la rendre (`acceptRecoTrendingHead` :
  web, bureau, Apple TV, Android TV, mobile (téléphone et iPad) — pas webOS), que le serveur
  déclare `reco.trending` ET que la préférence est allumée
  (`reco/trendingHeadRequest.ts`), sous une clé de cache À PART
  (`["reco-page", filtre, "trendingNow"]`) : coupée, requête et clé d'avant ; exclusions, droits, « bibliothèque seule », filtre de
  plateformes et cartes absentes Vigie comme toute rangée ; les rangées
  suivantes perdent ses titres, sauf `trending`, gardée ENTIÈRE pour l'accueil
  qui peut l'épingler — « Pour vous » ne la montre pas (`forYouPageRows`).
  Préférence du COMPTE `trendingNow` (`/api/preferences/reco`, allumée par
  défaut ; absente d'un PUT d'avant, elle est GARDÉE) ; l'interrupteur
  (`useTrendingNowSetting`) : Réglages › Personnalisation (web, bureau,
  miroir), Réglages › Accueil (TV). Sans clé TMDB, rien.

## Réglages utilisateur — un catalogue, une ligne par réglage, sa portée dite

Les réglages du web LARGE et du bureau (`/settings/*`) se lisent dans le catalogue partagé
`packages/shared/src/settingsCatalog/wideSettingsSections.ts` (même grammaire que celui du mobile et du
web étroit, `settingsSections.ts` ; équivalences testées, même portée) : rubriques par INTENTION —
Regarder (Lecture, Langues et sous-titres, Téléchargements), Interface (Apparence, Accueil et
découverte), Vous (Famille, Compte et sécurité) —, deux niveaux, textes dans l'espace i18n `settingsWeb`.
- **Chaque réglage est une `SettingItem setting="<id>"`** (`components/settings/wide/`) : libellé, pastille
  de portée (`ScopeBadge` : Compte, Cet appareil, Octave seulement), une phrase qui dit ce qu'il fait,
  ancre `#<id>`. Un bloc qui porte son propre titre (la Famille, Octave) pose `settingAnchor("<id>")`.
  Un réglage nouveau : sa ligne dans le catalogue (portée, texte, mots-clés), puis son composant —
  `wideCoverage.test.ts` refuse l'un sans l'autre.
- **La recherche** (tête du rail) et le rail lisent le même catalogue ; une ligne dont les conditions ne
  tiennent pas ici (navigateur, profil de la Famille, serveur d'avant) n'existe ni dans sa page ni dans
  la recherche. Anciennes adresses : `WIDE_LEGACY_PATHS` (`/settings/data` → Lecture › Connexion).
- **Jamais une entrée de plus dans `lazyPages.ts`** pour une rubrique (la cible LG le substitue) :
  `Preferences` sert Lecture ET Langues (la rubrique se lit dans l'adresse).

## Aide — un guide, une source ; un rappel, jamais une bannière

Le guide « Bandes-annonces » (`/help/trailers`, `#admin` pour la partie
administrateur) n'a qu'UNE source : sa structure dans
`packages/shared/src/help/trailerGuide.ts`, ses mots dans l'espace i18n
`trailerHelp`. Le web, le bureau et le miroir le rendent ; les téléviseurs
n'en disent qu'une phrase qui renvoie vers eux — rien de focalisable sur la
fiche. **Le mobile ne l'a plus** (ni entrée dans l'Aide, ni route, ni rappel
sur la fiche — décision du 2026-10-06) : on n'y règle pas les bandes-annonces.

Le rappel de la fiche (« Vous ne voyez pas les bandes-annonces ? », hors mobile) suit une
règle partagée (`help/trailerHint.ts`, `useFicheTrailerHint`) : titre sans
AUCUNE bande-annonce ET serveur mal réglé (`/api/trailers/readiness`), rien
tant qu'on ne sait pas. Masqué « pour de bon », c'est une préférence du
COMPTE (`/api/preferences/hints`, liste FERMÉE `help/dismissibleHints.ts`,
miroir backend verrouillé, suivie en direct par la portée `hints`) : un
nouveau rappel masquable s'y ajoute, jamais une clé de stockage d'appareil.

## Tableau de bord d'administration — « À régler », puis « Recommandations »

La vue d'ensemble (`/admin`) dit l'état en UNE ligne, puis deux familles, dans
cet ordre : À RÉGLER (cassé : Jellyfin pas relié ou injoignable, clé
d'administration absente ou refusée, base en panne, Jellyfin incompatible,
mise à jour obligatoire — jamais masquable) et RECOMMANDATIONS (lien public et
HTTPS, clé TMDB, réglages de Jellyfin groupés en UNE entrée, lecture directe —
masquables par le COMPTE, rappels `admin*` de `help/dismissibleHints.ts`).
Une seule règle : `packages/shared/src/adminAttention/attentionModel.ts`. Une
nouvelle alerte du tableau de bord s'y ajoute (et sa clé dans la liste fermée
si elle se masque) — jamais un bandeau de plus. Tant que Jellyfin n'est pas
utilisable, ce qui en dépend se tait : une entrée dit la cause.

La carte « Serveur Tentacle » est TOUJOURS là (un état, pas une alerte) :
version en service, dernière publiée (`/api/admin/server-update`, tags
`server-v*` lus au plus toutes les six heures), « conseillée » ou
« obligatoire » (`serverUpdate/serverUpdateStatus.ts`). **Le serveur ne parle
jamais à Docker** (ni socket, ni API du démon — décision du 2026-10-03) : la
carte donne la commande à copier et constate seule le serveur revenu (`bootId`).

## Bandes-annonces (Apple TV) — le serveur relaie, il ne prête pas d'URL

L'Apple TV n'a pas de WebView : `GET /api/trailers/resolve` extrait la
bande-annonce par yt-dlp puis la RELAIE (`routes/trailerMedia.ts`). Jamais une
URL googlevideo rendue au téléviseur : elles sont signées pour l'adresse IP de
l'extraction. Le choix du flux (`services/trailers/trailerSource.ts`) prend le
maître HLS H.264 (client `visionos`, sans défi JavaScript), sinon un MP4 muxé —
jamais un filtre figé d'itags ou de « muxé », que YouTube rend caduc en
quelques semaines (« plantent 2 fois sur 3 », 2026-10-02). La fiche prépare la
bande-annonce (`/prepare`) ; chaque lecture rend compte au serveur (`/report`,
`docker logs … | grep '\[trailers\]'`). Mesures, banc et fragilités :
`docs/BANDES-ANNONCES.md`.
**Jamais un doublage par IA** (16/10) : YouTube met toutes ses pistes dans le
maître, chacune `AUTOSELECT=YES` — chaque lecteur prenait celle de la langue de
l'appareil, la voix de synthèse (`acont=dubbed-auto`). Le RELAIS tranche
(`services/trailers/audioTracks.ts`, `hlsAudio.ts`) : UNE piste par groupe, un
doublage humain dans la langue du serveur, sinon l'originale, `DEFAULT=YES` ;
jamais un MP4 doublé automatiquement. La version DITE est celle qu'on entend
(`playedTrailerVersion`, shared ; `audio` de `/resolve` et de l'aperçu) : une
« VF » doublée par IA est une VO, ni étiquetée ni classée VF. Seul le lecteur
officiel de YouTube (repli quand l'extraction est refusée) choisit encore seul.
**Aperçu au focus (Apple TV, Android TV)** : la carte focalisée demande l'aperçu
(`trailers.preview`, la machine partagée du bureau) ; il se joue DANS LA CARTE OUVERTE
(et la bannière) sur les pages en rangées (« La carte qui s'ouvre », ci-dessous, 19/10),
et dans la ZONE FIXE en haut de l'écran sur Parcourir (la grille qui reste, 18/10).
**Le délai** (du début du survol ou du focus à
la première image) est le MÊME partout — web, bureau, Apple TV, Android TV,
titres de Vigie compris (pont : `trailerPreview.delayMs`) — et se règle par
l'UTILISATEUR sur son appareil (800 ms par défaut ; 0,5 · 0,8 · 1,2 · 2 s dans
Réglages › Apparence sur le web et le bureau, 0,8 · 1,2 · 2 s dans › Lecture
sur la TV — tv-core `TV_TRAILER_PREVIEW_DELAYS`, décision de Damien) : une règle, shared
`previewDelay.ts` — la demande part AVANT le délai, jamais sous le plancher qui
écarte le défilement rapide (450 ms de focus tenu sur TV : tv-core
`tvTrailerPreviewTiming` ; 200 ms et un pointeur arrêté sur le web). Aucune
capacité : fonction purement client. Pendant l'aperçu, Lecture/Pause le met
VRAIMENT en pause, et MAINTENUE coupe le son de l'aperçu seul (le réglage « Son
des aperçus ») — tv-core `cards/previewRemote.ts` ; sur Android le maintien est
reconstruit par `createAndroidTvReader` ; l'indice, dans la colonne de gauche de la zone,
jamais sur l'image : `ZoneRemoteHint`.
**La carte qui s'ouvre** (décision de Damien du 19/10, sur banc web, à la place de la zone
sur l'Accueil, « Pour vous », les bibliothèques, Ma liste et Mes favoris ; Parcourir garde sa
grille sous la zone) — tv-core `cards/openCard.ts`, vue `redesign/openRow/` :
- **Tout en RANGÉES, une seule taille de carte** : celle des trois préréglages (`OPEN_CARD_HEIGHT`
  360 / 430 / 500, Grande par défaut). Au repos, des affiches ; la carte focalisée s'OUVRE en 16:9
  à la même hauteur, au RETRAIT de la rangée — calée à CHAQUE focus par la section native
  (`rowRevealStart` : `TentacleOpenRow.m`, `RevealScroller.kt` ; tvOS ne défile pas une rangée dont
  la carte est visible) —, les suivantes glissent de la différence, les PASSÉES s'effacent (0,02 :
  tvOS ne focalise plus une vue à 0,01 ou moins). Ses détails dessous, place RÉSERVÉE (hauteur de
  rangée FIXE, `OPEN_ROW` : rien ne se remet en page) : raison, méta, résumé en phrases entières,
  « OK : ouvrir la fiche · Maintenir OK : plus d'options » (« OK : lire » sur Reprendre et
  Prochains épisodes) ; effacés quand le focus quitte la rangée. Le focus se dit par l'OMBRE seule.
  HAUT / BAS entrent dans une rangée par la carte posée à son retrait (`openRowEntry`, sections
  natives des deux plateformes), jamais par celle d'en face. Une rangée ne MONTE que sa tête (ce
  qui tient à l'écran depuis le retrait), puis quatre cartes au-delà du focus, par paquets de huit
  (`openRowMounted`) : toutes montées, une bibliothèque créait 3 200 vues en six pas vers le bas.
- **La BANNIÈRE** (Accueil, « Pour vous » : `hero/HeroBanner`) est UNE cible, comme la Top Shelf
  d'Apple (HIG : la bannière défilante à une cible ; des contrôles de page y rendent le focus
  difficile à garder) : DROITE / GAUCHE tournent les titres (GAUCHE retenu tant qu'il y en a un
  avant, puis le rail : tv-core `hero/heroNav.ts`, `useHeroEdgeTrap`), BAS mène aux rangées ; OK :
  la fiche (hors bibliothèque : la demande), OK maintenu : le grand panneau (`cardPress`,
  `cardHold`, surface `hero`). Rotation seulement visible et SANS focus (`heroRotationActive`).
- **La bande-annonce se joue DERRIÈRE la page** (`PreviewStage` : le lecteur unique de
  `TrailerZone` en mode scène), au rectangle de la carte ouverte ou de la bannière
  (`openStageRects`) ; elles deviennent transparentes pendant la vidéo (`watching`) — jamais un
  lecteur PAR-DESSUS une cible. Celle de la bannière se joue ENTIÈRE, en 16:9 sur sa hauteur, calée à
  droite et fondue vers le noir (`OPEN_HERO_WATCH`, jamais recadrée), et la gauche n'est jamais vide :
  logo, méta, résumé court ; celle d'une carte ouverte garde le titre en petit, en haut à gauche, jamais
  au milieu de l'image. Sur Android, la TextureView se rogne elle-même à l'arrondi de la scène
  (`StageCornerContext`) : un parent arrondi ne la rogne pas.
- **« Ranger par » en tête de la barre** (pastille de tête `pill:group`, gardée par « Tout
  effacer ») : une bibliothèque par genre, décennie, lettres ou note — tv-core
  `groups/libraryGroups.ts` : un COMPTE par groupe d'abord (`useLibraryCatalogCounts`, aucun
  titre), d'où des rangées jamais vides dans un ordre connu avant le premier dessin, puis chaque
  rangée charge ses affiches à l'approche (deux rangées d'avance, `LibraryGroupRows`) ; la note en
  comptes cumulés, chaque palier une TRANCHE de la liste triée par note (`offset`, `maxItems`). Ma
  liste et Mes favoris par type, genre ou lettres, en mémoire, chaque titre dans UNE rangée
  (`groups/listGroups.ts`). Les filtres s'appliquent dans chaque rangée. Un titre sans genre n'a
  pas de rangée de genre (Jellyfin ne sait pas les demander).
- **Un titre HORS bibliothèque dit son résumé** : Vigie le joint à `titles/state` (`overview`,
  depuis la cache TMDB) ; un Vigie d'avant : sa raison et l'état de sa demande.
**La zone** (Parcourir seulement depuis le 19/10 ; tv-core `cards/previewZone.ts` décide QUOI
et QUAND, sans rien dessiner) : le sujet est la carte focalisée, AUSSITÔT (0 ms : son fond et son
titre au focus), gardée quand le focus part ailleurs (filtres, rail) — la zone ne se vide jamais
sous les yeux ; avant tout focus, le repli de la page (sa première carte). `HeroZone` (le héros
qui vivait dans la zone) n'a plus d'écran : la bannière l'a remplacé. Les détails (synopsis, genres, qualité) se lisent au focus TENU
(`PREVIEW_ZONE_DETAILS_MS`, 300 ms : une rafale ne lit rien). Fondus d'opacité seulement
(`PREVIEW_ZONE_FADE` : fond 200, texte 160, vidéo 360 en entrée, 180 en sortie) ; le fond
passe en fondu croisé sur deux calques (`previewZoneBackdropLayer`), jamais un noir entre
deux. **L'image ne déborde jamais de la zone** (retour de Damien, 18/10 soir : les cartes de la
première rangée masquaient le bas de la bande-annonce) : fond et vidéo cadrés au centre dans
1280 × 432 (tv-core `PREVIEW_ZONE_MEDIA`), raccordés au noir à gauche et en bas dans leurs propres
bords ; le voile noir de la scène est plein jusqu'au bas de la zone (`previewZoneVeilStops`), la page
commence sur le noir. **Pendant la bande-annonce, une version ALLÉGÉE mais REMPLIE** (« la gauche
devient une grande zone noire, c'est dommage ») — tv-core `cards/previewZonePlayback.ts`
(`previewZoneWatching` : la vidéo se montre, pause comprise) : le repos (surtitre, raison, grand logo,
synopsis long) cède en fondu croisé (420 ms ; retour 240) à une colonne À GAUCHE de la vidéo, jamais
dessus (`previewZoneWatchLayout`, `ZoneWatchText`) : logo plus petit, méta, description courte en
phrases entières, l'indice de la télécommande ; les voiles pleins du repos s'effacent, un raccord
léger reste. **L'indice** (« Lecture/Pause : pause », « maintenir : couper le son », une ligne par
geste, jamais coupé) se lit 4 s au départ et après chaque geste, puis s'efface ; il reste en PAUSE
(`previewZoneHintShown`, `useZoneHint`). **Jamais un « … » au milieu d'un mot** : le synopsis garde
ses phrases entières, sinon une articulation, sinon rien (`previewZoneSynopsis.ts`, d'après ses
lignes mesurées : `ZoneSynopsis`) ; surtitre et raison se resserrent ; un logo trop étroit (vertical,
carré : `previewZoneUsesLogo`, < 1,2) cède au titre écrit. UNE portée par page (`PreviewZoneScope`, posée par `BelowZonePage`) : la carte dit
son focus (`useCardZoneFocus`, daté au rendu qui le constate), la zone lit le magasin ;
une page couverte (fiche, grille par-dessus) coupe son aperçu et démonte son lecteur
(`useIsFocused`) — un seul lecteur vivant. Vue : `redesign/previewZone/` (fond 1280 × 432
en haut à droite, dans la zone, fondu vers le noir à gauche et en bas, texte à gauche) ; intégration :
`redesignWiring/trailerPreview/TrailerZone.tsx`.
**La page sous la zone** (tv-core `focus/previewZoneLayout.ts`, cadre
`redesign/rows/BelowZonePage.tsx`) : la zone occupe le haut (`PREVIEW_ZONE_HEIGHT`,
432 : 40 %), la page défile DESSOUS, dans sa fenêtre (648), jamais sous la zone — tvOS
ne focalise pas un élément recouvert. Rangées et lignes sont FIXES : seul le focus
bouge, rien ne grandit, aucune remise en page au changement de focus. La section
focalisée se pose TOUJOURS au même endroit, juste sous la zone (`BELOW_ZONE_REVEAL` :
mode `anchor` de `FocusSection`, natif sur les deux plateformes), la première comme la
dernière (marge du bas : `belowZoneBottomRoom`, mesurée sur la dernière section). La
zone garde ses 432 sur toutes les pages : ce sont les affiches d'une RANGÉE qui ne dépassent
pas ce que la fenêtre peut montrer, rangée focalisée entière (tv-core `belowZoneFrameCap` —
une affiche en taille Grande y est un peu réduite, voulu : la même taille réglée donne donc une
affiche de rangée plus petite que celle d'une grille ; une vignette jamais), et la raison d'une
reco se lit dans la zone, plus sous la carte ;
l'en-tête d'une grille ramène la page en haut. Seule une carte d'une page à zone demande et prépare l'aperçu
(`useInPreviewZone` : sous une `PreviewZoneScope` ; `useCardPreviewFocus`, la seule
couture de la carte, qui passe au port `useCardZoneFocus`) : la recherche et la fiche
n'en demandent pas. Une rangée sortie de
l'écran revient au début comme toute rangée de l'accueil (tv-core `focus/rowRewind.ts`,
ses voisines immédiates gardées), et Retour l'y remet D'UN COUP, le focus aussitôt sur
sa première carte (`rowRewind.back`, jamais le défilement de tvOS : ~1,4 s).
Sur Apple TV, une rangée de l'accueil et de « Pour vous » garde la carte focalisée
au retrait de la rangée, jamais sous le rail (`FocusSection rowReveal` →
`TentacleRowScroller.m`, qui corrige la cible de tvOS par tv-core `rowRevealOffset`,
la règle d'Android) ; un pas ISOLÉ s'y joue sur le ressort de la page (tvOS ne bouge
rien : son animateur traînait jusqu'à +1,15 s), une rafale reste à tvOS (défilement rapide).
Dans une GRILLE (bibliothèque, Ma liste, Favoris, Parcourir, collection), chaque LIGNE
est FIXE (`GridLine`, tv-core `cards/trailerPreviewGrid.ts`) : ni défilement, ni
rotation, ni tête collée au rail, ni reprise ; GAUCHE/DROITE ne déplacent que le focus,
HAUT/BAS gardent la COLONNE (tv-core `gridLineEntries` : entrée `tvEntry` des lignes
voisines), même au défilement ACCÉLÉRÉ, où tvOS déplace le focus seul : la colonne retenue
est rendue dans la ligne d'arrivée dès que la page ralentit au bout de sa course (si la ligne du
focus connu est à l'écran), sinon la grille posée — jamais en plein mouvement, jamais
d'après la fin d'un maintien, que la Siri Remote n'annonce pas toujours (tv-core
`focus/gridColumnHold`, port `gridSettlePort`). Les titres autour du focus se préparent d'avance (`trailers.previewWarm`,
tv-core `trailerPreviewWarmTv.ts`).
**L'aperçu ne gêne jamais la navigation** : la cellule d'une carte garde TOUJOURS sa
taille de repos (`CardShell` : plus de cellule qui s'élargit, de cible gardée à part ni
de place du pied) — HAUT et BAS partent du centre de la carte. La zone a UN LECTEUR
(`ZoneVideo`), jamais démonté puis remonté d'un titre à l'autre : seule sa SOURCE change
(react-native-video sur Apple TV, mesuré : aucun lecteur créé sur dix cartes ; l'ExoPlayer
partagé sur Android TV) — une rafale de flèches ne crée ni ne détruit rien, la source ne
change qu'au focus tenu. Une session qui veut la source déjà prête l'apprend aussitôt
(`readyKey`, clé `uri#startAt`) : aucun avis ne reviendrait. La vidéo sortie reste montée en pause ;
le lecteur se démonte après `PREVIEW_ZONE_PLAYER_IDLE_MS` (30 s) sans aperçu ou dès que la page est
couverte. La session d'aperçu d'un titre (`ZoneSession`, la machine du bureau, sans
lecteur à elle) ne se monte qu'après 250 ms de focus tenu, datée de l'arrivée du focus
(`trailerPreviewDwell.ts`). Android : l'aperçu a
son PROPRE lecteur natif (`TentaclePreviewVideo`, `exoplayer/PreviewVideoView.kt` :
la PlayerView sans contrôleur, une TextureView, aucun focus possible, UN ExoPlayer
partagé par tous les aperçus, `PreviewPlayerPool`, relâché après 60 s sans aperçu) — celle de
react-native-video gonflait un contrôleur à chaque aperçu (fil UI bloqué au
départ de l'aperçu suivant) dont le bouton volait le focus de la carte ; l'élément
vidéo passe par l'adaptateur `platform/tvos/player/previewVideoElement`.
Rythme : tv-core `cards/trailerPreviewTv.ts` ;
vue : port `redesign/cards/trailerPreviewPort.tsx` ; intégration :
`redesignWiring/trailerPreview/` (une session, le sujet focalisé de la zone seulement) ;
banc : scènes `apercu/*` du banc UI.

## Famille — un contrat, et le serveur décide de tout

Propriétaire, membres, invités (vrais comptes Jellyfin cachés, mot de passe
jeté), profils de l'Apple TV, code PIN : le CONTRAT est dans
`packages/shared/src/family/` (`familyContract`, `familyTvContract`,
`familyProtocol`, `familyRoutes`, `familyRules`, `familyRights`), recopié octet
pour octet dans `apps/backend/src/family/` (`familyMirror.test.ts`) ; carnet :
`docs/FAMILLE.md`.

- **UNE famille par compte, PARTAGÉE (v2)** : propriétaire OU membre, jamais
  deux — la base le tient (`family_members.userId` unique, le propriétaire y a
  sa ligne `owner`). Seul le propriétaire invite, retire, règle les droits et
  dissout ; un membre crée des invités si le propriétaire le lui permet (avec
  la politique Jellyfin de SON créateur) et ne gère que les siens. La TV de
  tout membre montre toute la famille ; un membre qui part perd les autres
  profils sur ses TV et quitte celles des autres. Une base v1 passe en v2 par
  `core-init.sql` sans rien perdre (fusion des familles croisées) — banc :
  `zsh apps/backend/test/famille-migration/banc.sh`.

- **Rien ne se décide sur un client** : PIN haché et vérifié par le serveur
  (jamais envoyé à une TV), droits lus dans `FAMILY_ROUTES` (`callers`), à
  l'identique en HTTP et en HTTPS — aucun jeton ni PIN dans une URL ni un
  journal (`[family]`).
- **Apple TV : le jeton de jumelage s'ÉCHANGE** (`/api/family/tv/enroll`)
  contre un jeton « profils seuls » qu'aucune autre porte ne connaît — il
  liste les profils, en ouvre un, se déjumelle. La session de profil est une
  ligne ENFANT de `paired_devices` : un jeton d'appareil au nom du profil, qui
  passe toutes les portes comme un jumelage. Une TV d'avant garde son jeton.
- **Gestes personnels** (accepter, refuser, quitter, dissoudre) : jeton
  Jellyfin du web, du bureau, du mobile seulement — jamais une TV, un profil de
  TV ni « voir en tant que ». **Seule exception : SON PIN**, que le propriétaire
  ou un membre pose, change ou retire aussi depuis SON profil sur la TV
  (`setOwnPin`, appelant `tvProfile` ; l'acteur est la session, jamais le
  corps). Changer ou retirer un PIN existant exige `currentPin`, vérifié comme
  à l'ouverture d'un profil (même compteur, même blocage). Un invité garde le
  PIN de son propriétaire ; le compte de démonstration n'en pose jamais.
- **Gérer depuis un profil, derrière SON code** (1.30.0, `family.profileManage`,
  décision du 2026-10-16) : le propriétaire ou un membre gère la famille depuis
  SA session de profil (TV, bureau), avec les droits de son RÔLE — jamais sans
  code PIN (n'importe lequel : `familyCallers.ts` › `profileManage`), jamais au
  nom du compte de l'appareil. Ouvrir son profil par son code ouvre la gestion
  (dix minutes glissantes), sinon `tvManageUnlock`. « Qui regarde ? » ›
  « Gérer les profils » : le compte de l'appareil (TV : celui qui l'a jumelée).
  Accepter, refuser, quitter, dissoudre restent personnels.
- **Le web a « Qui regarde ? » comme le bureau** (1.31.1, `family.webProfiles`, plateforme
  `web`) — le même code, choisi par `apps/web/src/profiles/pickerPlatform.ts`. Le web s'authentifie
  par COOKIE, qui l'emporte sur tout Bearer : ouvrir un profil réécrit donc les cookies côté
  serveur, et le jeton du COMPTE part en réserve httpOnly (`tentacle_account_token`,
  `routes/family/accountEscrow.ts`), jamais dans la page ; il ne revient que derrière SON code.
- **Le cookie ne l'emporte que s'il porte une session posée par le serveur** (profil du web,
  « voir en tant que » : un JWT). Un cookie de CONNEXION (jeton Jellyfin) cède au Bearer et au
  message `auth` de la socket (`services/sessionTokenChoice.ts`) : React Native GARDE le cookie
  que `/api/auth/login` pose (le compte) et le renvoie avec chaque requête ET chaque poignée de
  main WebSocket — lu d'abord, il faisait du compte l'hôte et le présent de Watch Together d'un
  profil (alpha mobile, 20/10). Une socket sans User-Agent « Mozilla/… » attend son `auth`. Le proxy
  Jellyfin et la vignette trickplay suivent la même règle après les en-têtes (`incomingAuth.ts` :
  l'`api_key` d'AVPlayer l'emporte). Et le cookie n'est plus donné qu'à un NAVIGATEUR :
  `/api/auth/login` et `/api/auth/refresh` le RETIRENT à une app native (`offerSessionCookie`). Un
  banc sous Node ne voit pas ce cookie sans pot : `bench:wt-profile-cookies` (`reactNativeJar.ts`).
- **Le hors ligne appartient au COMPTE DE L'APPAREIL** (celui qui s'y est connecté, jamais le
  propriétaire de la Famille ni le profil ouvert ; règle du 21/10, `offline-core` ›
  `rights/offlineOwner.ts`, mobile ET bureau) : une session de profil n'en voit rien (ni bouton, ni
  page, ni marqueur, ni réglage) ; le moteur tourne avec le jeton du compte (`offlineOwnerOf`) ; un
  compte à qui le serveur refuse `keepOffline` ne voit rien (dernier mot retenu,
  `tentacle_offline_keep_right`). Plus de connexion pendant un profil → retour d'office au compte
  (`offlineSessionFallback` : mobile `OfflineAccountFallback`, bureau `offline/accountFallback.ts`),
  dit dans le message de passage hors ligne ; au retour du réseau, rien ne se rouvre.
- **Un invité n'apparaît dans AUCUNE liste** (Watch Together, candidats,
  utilisateurs, admin, classement, recommandations en fond) ; seulement dans
  les sessions en cours (`familyGuestOf`). Toute nouvelle liste de comptes
  passe par `withoutFamilyGuests` (`familyGuestMarkers.ts`), la seule source.
- **Une session de profil regarde, elle n'administre rien** (hors la gestion de
  la Famille ci-dessus ; ni push, ni
  téléchargements, ni jumelage, ni compte) ; un invité n'a en plus ni Watch
  Together, ni tickets, ni partage, ni extensions — sauf « peut demander »,
  que le propriétaire seul lui donne (et que seule une extension qui sait
  demander un titre rend proposable) : sur les routes d'extension, et là
  seulement, il agit alors à SON PROPRE NOM, jamais admin
  (`familyGuestExtensions.ts`) : une seule liste de
  préfixes, `profileSessionLimits.ts`, appliquée par `requireAuth`.
- **Proxy : un jeton d'appareil n'écrit que SES données** (le proxy lui prête
  la clé admin) : `jellyfinProxy/deviceWrites.ts`, relevé de ce que les TV
  livrées envoient. Un nouveau geste d'écriture d'une TV s'y ajoute, testé.
- Un nouveau geste de la Famille : une entrée dans `FAMILY_ROUTES` d'abord,
  jamais une route à part.

## Base de données — SQLite, et la migration depuis MariaDB (1.25)

**Une seule base : `data/tentacle.db`**, SQLite, dans le volume de données — rien à configurer, plus d'étape
« base de données » (`docs/sqlite/DECISION.md`). Prisma en moteur natif à UNE connexion ; dates en INTEGER
millisecondes UTC (jamais du texte, `CURRENT_TIMESTAMP` interdit en SQL brut) ; migrations versionnées
(`prisma/migrations-sqlite/`, exécuteur `services/database/migrator.ts` par `node:sqlite`, Prisma fermé).
**Jamais `node:sqlite` sur `tentacle.db` pendant que Prisma l'a ouverte dans le même processus** (les verrous
ne se voient pas) : au démarrage avant Prisma, ou dans un AUTRE processus. Casse normalisée à l'entrée (pas de
`COLLATE NOCASE`). Jamais `prisma db push`.

**MariaDB n'est plus qu'une SOURCE, lue une fois, jamais modifiée** (`apps/backend/src/dbMigration/`, qui
partira avec elle dans 2 ou 3 versions) :

- **Déclenchement** : le socle dit « en attente » (`legacySourceState()` : MariaDB configurée par `DATABASE_URL`,
  `DB_*` ou le fichier de l'ancien assistant, et pas de `tentacle.db` installée). En tête de `main()`, un
  serveur de MAINTENANCE À PART (`maintenance/`) : ni Prisma, ni route du cœur, ni extension ; `/api/health`
  (`database` additif, nombres et motif d'une liste FERMÉE seulement) et `/api/config` sans base, 503
  `{ state: "migrating" }` partout ailleurs — `/api/setup/*` compris (status en 503, jamais « ouvert »),
  `/api/ws`, `/api/plugins/*` — et une page d'attente minimale autonome (FR/EN, ES5, `/tv` compris, même web
  coupé). À la réussite il se ferme, puis le démarrage normal : Prisma, routes, extensions, UNE fois. Jamais
  de bascule à chaud.
- **La copie** : connexion READ ONLY + instantané cohérent (pilote `mariadb`, `logParam:false`), colonnes lues
  dans `information_schema`, pages sur la clé primaire ; URL relue comme la 1.24 la donnait à Prisma (TLS
  demandé = TLS exigé ; paramètre inconnu = échec clair) ; fuseau de la source lu, colonnes « session »
  converties (`CONVERT_TZ`). Cœur selon le DMMF, Famille v1→v2 et purges de `core-init.sql` rejouées en TS,
  tables d'extension recopiées ENTIÈRES (forme exacte : `docs/sqlite/GENERIC-COPY.md`, qui fait foi pour
  Vigie), tables non reconnues copiées par précaution, collisions de noms refusées. Installation scellée
  d'après la source AVANT tout ; brouillon `tentacle.db.migrating` 0600 ; vérification (sommes par colonne,
  clés étrangères, contrôle « API » par Prisma dans un processus ENFANT) ; rapport
  (`server_config[sqlite_migration_report]` : noms, comptes, durées — jamais une valeur) ; fsync, renommage.
- **Coupure** : tout sauf `tmdb_meta_cache` (≈ 0,1 s de données, quelques secondes en tout) ; ce cache (~99 %
  du volume) est copié APRÈS la bascule par un processus enfant (lots courts, `INSERT OR IGNORE`, reprise,
  marqueur de fin), la reco l'attend 30 min au plus.
- **Échec** : MariaDB intacte, écran d'échec public sobre (motif sans détail), essais de 30 s à 15 min,
  `tentacle db migrate` (essai immédiat, rapport), journal `[db-migration]`. Source d'avant la 1.4.0 :
  passer par la 1.24.
- **Après** : divergence de la source contrôlée au démarrage (§ 3.10 : autre base, données changées, source
  vide remplie → « À régler », rien d'automatique, « Migrer à nouveau » = marqueur + redémarrage contrôlé,
  base actuelle en `.bak`) ; base installée jamais migrée face à une MariaDB → « À régler » ; « MariaDB n'est
  plus nécessaire » (recommandation masquable `adminRemoveMariadb`) après la migration ET le cache, avec la
  marche à suivre par installation (`admin/removalGuide.ts`, sans Docker ; jamais d'après `TENTACLE_STACK`
  seul) : pile officielle d'avant → passer à sa remplaçante (`newStack`) OU retirer les lignes, une étape par
  ligne ; source dans le fichier de l'ancien assistant → la commande qui le supprime ; `DROP DATABASE` et
  `rm` rendus par le serveur, à copier, jamais exécutés.
- **MariaDB retirée trop tôt** (secret `db_password`, ou un marqueur qu'un serveur d'avant a laissé dans son
  dossier de données — `LEGACY_DATA_MARKERS` : `setup-complete`, `compat/`, `update/`, `plugins/`, `tools/`,
  qu'une 1.25 neuve ne crée qu'après `tentacle.db` —, sans source ni base) : jamais une base vide — écran
  d'attente `source_missing` ; sortie volontaire : `tentacle db start-fresh --confirm`. Conséquence en dev :
  supprimer `data/tentacle.db` seule ne remet pas à zéro (vider `data/` sauf `shared-deps/`).
- **Pendant une migration, une seule porte par client** (`useDatabaseMigrationGate`, api-client) ; jamais le
  voile hors ligne ; TV : tv-core `decideMigrationScreen`.
- Banc réel : `apps/server-e2e/sqlite-bench/` (dump de production NEUTRALISÉ, jamais l'original ; réseau
  `--internal`). Doc utilisateur : `docs/server/sqlite-migration.md` (et `fr/`).

## Serveur — installation, piles, accès à distance (v2)

Doc utilisateur : `docs/server/` (EN) et `docs/server/fr/`. **DEUX piles, pas une de plus** (décision de
Damien, 2026-10-08), à leurs adresses déjà connues : `stacks/tentacle-full/compose.yaml` (Tentacle + Jellyfin,
`TENTACLE_STACK: full`, `JELLYFIN_INTERNAL_URL`) et `stacks/tentacle-only/compose.yaml` (Tentacle seul,
`TENTACLE_STACK: only`, `host.docker.internal`). **Aucune base** (ni `db`, ni `init`, ni `tentacle-secrets`),
**aucun secret écrit**, **jamais le socket Docker**, jamais root (`PUID:PGID`, tini, su-exec). `SetupStack`
reste `full | db | only` (contrat qui traverse le réseau) : aucune valeur nouvelle. `stacks/tentacle-db`, le
`docker-compose.yml` et le `docker-compose.external.yml` de la racine sont RETIRÉS : la copie d'un
utilisateur reste valable (sa MariaDB migre d'elle-même) ; une pile Portainer qui suivait un fichier retiré
garde le sien. Une pile qui reçoit le nouveau compose AVANT d'avoir migré tombe sur `source_missing`
(conséquence acceptée ; la doc dit de pointer Portainer sur l'étiquette `server-v1.24.0` le temps de la
migration). Les volumes gardent leurs noms (`tentacle-data`, `jellyfin-*`) : une pile d'avant remplacée dans
le même dossier les reprend. **Aucun réglage des
médias pour Tentacle** : seul Jellyfin monte `MEDIA_PATH` ; `films`/`series` naissent de `jellyfin-init`
(l'image de Jellyfin, une fois en root) ; Tentacle lit les dossiers par l'API de Jellyfin
(`stacksContract.test.ts` le tient : deux piles, aucune base, aucun service de l'image Tentacle ne monte
`/media`, aucun compose à la racine).

- **Assistant d'installation** (`/api/setup/*`, `apps/backend/src/setup/`) : **sans code depuis la
  maison** (modèle Jellyfin / Plex, `POST /session/local`, `setup/localAccess/`) — le PREMIER navigateur
  arrivé DIRECTEMENT d'une adresse privée (RFC 1918, ULA, lien local, boucle locale ; pas le CGNAT) le
  réclame : sans mandataire ou par un voisin de confiance, jamais par la passerelle du conteneur (Docker
  Desktop/colima y font passer Internet), et l'hôte TAPÉ doit être local (un domaine public → code). Le
  réclamant (`data/setup-claimant`) garde la place ; une autre adresse → `setup_in_progress`, le code.
  Ailleurs, un code à usage unique (12 car. Crockford, journaux + `data/setup-token.txt`) s'échange contre
  une session. Toute session (en-tête `X-Tentacle-Setup`, jamais un cookie) est LIÉE à l'adresse qui l'a
  ouverte. Modèle de menace : `docs/server/setup-security.md`. Fini, il est **fermé pour toujours** (404
  partout sauf `GET /status`, gardé pour les clients livrés) ; seule la CLI de l'image le rouvre
  (`tentacle setup token|reset`, un `tentacle` en trop en tête est pardonné). `GET /host` (public, ouvert
  seulement) dit `codeRequired` pour CE navigateur et où lire le journal : pile, conteneur, identifiant
  court lu dans `HOSTNAME` ou le montage de `/etc/hostname` (`setup/hostInfo.ts`) — l'écran du code en tire
  ses onglets (Portainer, `docker logs <ID>`, Compose, NAS, natif) ; aucun texte ne suppose `docker
  compose`. Refus = `{ error: <SetupErrorCode> }`, jamais un message brut ni une réponse de Jellyfin.
  Contrat : `packages/shared/src/setupWizard/setup{Wizard,Discovery}Contract.ts`, recopiés dans le backend
  (test miroir). **Pile complète : SON Jellyfin en tête et choisi d'office**, joint par
  `JELLYFIN_INTERNAL_URL` (même vu par son port publié : même identifiant → lui, `jellyfin/stackTarget.ts`),
  prouvé sur un sous-réseau du conteneur (`jellyfin/siblingCheck.ts` — un service renommé envoie le nom au
  DNS du réseau local) ; le voisin est **verrouillé au démarrage** (`claimed`) puis pris par le compte
  choisi. Les AUTRES Jellyfin restent choisissables : la clé du voisin verrouillé est mise de côté (un retour
  sur lui la reprend), le choix survit au redémarrage (`jellyfin_stack_choice`) ; un Jellyfin étranger gardé
  par une base reprise SANS ce choix est oublié. `GET /jellyfin/discover` liste TOUS les Jellyfin joignables
  (UDP 7359, hôte du navigateur + passerelle sur les ports courants, bornée, adresses privées seulement),
  celui de la pile en tête. **Un Jellyfin DÉJÀ configuré** (`joined`) : compte existant, AUCUNE bibliothèque
  créée, écran « Réglages conseillés » — la règle du tableau de bord (`adminAttention/jellyfinAdvice.ts`),
  les gestes de l'admin (`/jellyfin/recommended`, liste fermée), seulement ce qui est coché. L'adresse de Jellyfin des APPLICATIONS
  (`jellyfin_private_url`, `jellyfin/clientUrl.ts`) = hôte du navigateur + `JELLYFIN_HOST_PORT`, jamais un
  nom Docker, ni 8096 supposé, ni l'IP de la passerelle. Jamais de `prisma db push` (il supprime les
  tables des extensions).
- **Le PARCOURS est une machine à états partagée** (`packages/shared/src/setupWizard/setupFlowContract.ts`,
  recopiée dans le backend) que le SERVEUR fait respecter (`setup/flow/`) : le choix du Jellyfin
  (`POST /jellyfin/select`, gardé dans `setup_jellyfin_selection`) n'est jamais sauté ni fait d'office, et
  fixe le parcours — neuf (`fresh` : compte CRÉÉ, puis vraies bibliothèques Jellyfin) ou déjà configuré
  (`configured` : connexion, puis réglages conseillés). Tout geste hors parcours → `step_refused` (409) :
  jamais de compte ni de bibliothèque créés sur un Jellyfin déjà configuré, même par un appel direct.
  Changer de Jellyfin oublie l'ancien (sa clé révoquée si l'installation l'a créée) ; `tentacle setup reset`
  efface le choix. Un nouveau geste de l'assistant : une `SetupAction` d'abord, jamais une route sans garde.
  **Seule exception au « rien de créé »** : un Jellyfin configuré trouvé SANS AUCUNE bibliothèque à la connexion
  (`noLibraries`, constaté par `connect`, gardé avec le choix) reçoit l'écran des bibliothèques entre connexion et
  réglages — FACULTATIF (« Passer ») — et `browse` / `createLibraries` y sont permis ; avec des bibliothèques, 409.
  Les dossiers suivent la machine de JELLYFIN (`BrowseResult.style` : `posix` ou `windows`, lu sur ses lecteurs) ;
  dans la pile, son `/media` est dit tel que Jellyfin le voit, « dossier `MEDIA_PATH` » pour l'hôte —
  `TENTACLE_MEDIA_HOST_PATH` n'est plus posé, seul un compose d'avant le donne encore (affichage enrichi).
  **Clé TMDB** (écran `tmdb`, FACULTATIF, dans les deux parcours juste avant le récapitulatif, seulement si le serveur
  déclare `flow.tmdb`) : `POST /api/setup/tmdb` (geste `tmdb`, relié) valide la clé par `checkTmdbKey` comme l'admin ;
  « Configurer plus tard » (`setup_tmdb_later`) masque à `/complete` l'avis `tmdbKey` du COMPTE administrateur
  (`dismissAccountHint`) s'il n'y a toujours aucune clé — la recommandation `adminTmdbKey` du tableau de bord reste.
- **Aide de l'assistant** : une page du site par étape, adresses STABLES dans
  `packages/shared/src/setupWizard/setupDocLinks.ts` (le site les tient ; jamais renommées), et « Besoin
  d'aide ? » repliable sous l'explication de chaque écran (`setupHelp.ts`, clés `help_<étape>_<id>_q|a`). Un écran sans page
  du site (`SetupStepWithoutDoc` : `tmdb`) n'a que ses questions — jamais une adresse inventée. Dans l'app Windows,
  l'accueil et le code renvoient à `windows/` (la page de l'app, aussi site web de sa fiche Store).
- **Interface de l'assistant** (`apps/web/src/components/setupWizard/`) : une question par écran, état pur
  `wizardState.ts` (on ne va, n'avance, ne revient que DANS le parcours), chargée à la demande par `pages/ServerSetup.tsx` — `App.tsx` est aussi compilé par
  le client LG, qui ne la porte pas : cette porte y est substituée (écran « Indisponible ») et sa feuille ne
  balaie pas `components/setupWizard/` (`EXCLUDED_WEB_DIRECTORIES` de `substitutionTable.ts`) ; un de ses
  modules entré dans le graphe LG arrête le build (`excludedDirectoriesGuard`). Le mot de passe ne vit qu'en mémoire. L'écran du code n'est dans
  le parcours que si `codeRequired` ; la langue des métadonnées est sous le compte (plus d'écran à part) —
  pour un Jellyfin neuf seulement. Liste Jellyfin : `JellyfinList` (pile, neufs, déjà configurés).
  **Un seul cadre, PLEINE PAGE** (`WizardFrame`) : en-tête (les cinq grandes étapes de `wizardPhases.ts`, la
  progression, la langue), l'explication à gauche et l'action dans un panneau à droite (`layout="wide"` pour
  une grille : réglages conseillés, accès à distance ; une colonne sur un téléphone), un pied FIXE — « Retour »
  et UNE action principale, toujours visibles. Seul le corps défile. Un formulaire garde ses champs dans le
  panneau et son bouton au pied, relié par l'attribut `form` (Entrée l'envoie) ; jamais un bouton d'envoi
  dans le panneau. Toute attente passe par `SetupWaiting` (anneau, phrase, barre si l'on sait mesurer),
  tout refus par `SetupErrorLine` — jamais un squelette ni un « … » recopiés.
- **Interface web désactivable** : `TENTACLE_WEB_UI=off` (commenté dans les deux piles) ou `tentacle web
  on|off|default|status` (fichier `data/web-ui`, relu toutes les 5 s, qui l'emporte sur la variable) —
  `static/webUi.ts`. Coupée : 404 pour le client web ; restent `/api` (sockets compris), `/tv`, `/.well-known`,
  les logos publics, `/yt-embed.html` (relais YouTube des bandes-annonces du BUREAU : coupé en 1.25.0, page
  blanche), `/avatars/*` (repli du mobile pour la troupe) et l'assistant TANT QUE l'installation n'est pas finie. Un fichier du web qu'une APPLICATION charge
  s'ajoute à cette liste. Le lien d'invitation (`/register?invite=…`) reçoit alors la page d'inscription
  AUTONOME du serveur (`static/invitePage.ts` : FR/EN, ES5, nonce, rien du client web) ; chaque refus de
  `POST /api/auth/register` y est dit par son `code` (`RegisterRefusalCode`). Aucun réglage dans
  l'administration (elle EST l'interface web) ; aucune capacité.
- **`trustProxy` limité aux voisins** (`services/trustedProxies.ts` : boucle locale, RFC 1918, ULA, réseaux
  Docker, + `TRUSTED_PROXIES`) ; l'adresse réelle d'un client se lit par `getRealClientIp`, jamais
  `request.ip` (compteur de débit, réseau local, journaux). Docker Desktop/colima perdent l'adresse source :
  documenté, pas contourné.
- **Accès à distance** (`apps/backend/src/remoteAccess/`, section admin `/admin/remote-access` sous
  `requirePersonalAdmin` — jamais une TV jumelée) : **ce qui est réglé est publié**, comme en 1.23.0
  (`remoteAccess/exposure.ts`) — plus d'interrupteur (il retenait les adresses d'un serveur venu de 1.23.0 :
  accès à distance cassé, corrigé avant toute livraison de 1.24.0 ; `settings.enabled` n'est plus qu'un constat).
  Les adresses restent les clés et les routes de 1.23.0 (`public_url`, `jellyfin_private_url`,
  `jellyfin_public_url`, `/api/admin/public-url`, `/api/admin/direct-streaming`) : la page s'ouvre sur l'état en
  lecture seule, puis UN formulaire d'adresses prérempli ; mandataire, ports, test sont repliés dans « En savoir
  plus », jamais exigés. Face à un serveur qui déclare `admin.remoteAccess`, Services n'en garde qu'un renvoi
  (`#publicurl`, `#directstreaming` y mènent). `/api/config` → `publicUrl` : le lien public, sinon l'adresse
  privée réglée, sinon celle par laquelle un client du réseau local joint le serveur (`pairingAddress.ts`) ; les
  clients se rabattent sur l'adresse par laquelle ILS lui parlent (`pairingServerUrl`, shared). La lecture
  directe n'exige que l'adresse PRIVÉE (l'installation l'allume à la maison) ; la publique est facultative.
  **CorsHosts de Jellyfin tenus seuls** (`services/jellyfinCorsSync.ts`) : nos origines (lien public, adresse
  locale, page de l'admin, `tentacle://app`) au démarrage, au retour de Jellyfin, à chaque enregistrement, avant
  chaque test ; une liste vide ou avec `*` n'est JAMAIS touchée (Jellyfin y accepte tout ; y écrire la fermerait).
  Le CORS de Tentacle accepte en plus de `CORS_ORIGINS` ses adresses réglées et sa propre origine
  (`services/tentacleCors.ts`). Adresse publique détectée (`/remote-access/public-ip` : dernier
  test, sinon Cloudflare `cdn-cgi/trace` en IPv4), les DEUX ports avec leurs vrais numéros ; capacité
  `admin.remoteExposure`. Le panneau est le même dans l'assistant et l'admin. Ports, mandataire HTTPS — **aucune pile
  n'en embarque** (décision du 2026-10-06 : l'utilisateur a le sien) ; l'admin et la doc donnent les
  extraits à y poser (Caddyfile, Nginx/NPM, Traefik : `remoteAccess/proxySnippets.ts`), test d'ouverture mené **depuis l'extérieur** par le service
  `apps/port-check` (`REMOTE_CHECK_URL`, défaut check.tentacletv.app, `off` le coupe). Le service ne teste
  que l'adresse du demandeur ; Tentacle se prouve par un défi `/.well-known/tentacle-check/:id` (60 s).
  **Aucun workflow ne construit ni ne déploie `apps/port-check`.** Tailscale = plan B documenté, jamais
  intégré. Contrats : `packages/shared/src/remoteAccess/{checkProtocol,remoteAccessContract}.ts`, recopiés
  dans le backend (et le protocole dans `apps/port-check/src/`), tests miroirs. Verdict partagé
  (`remoteVerdict.ts`) : la cause probable en mots, CGNAT par l'adresse WAN de la box.
- **Une page admin de plus SANS entrée dans `lazyPages.ts`** : la cible webOS le remplace
  (`apps/tv-webos/.../lazyPagesTv.tsx`) et casserait sur une export inconnue. « Accès à distance » passe
  donc par le module paresseux de la page Services (`AdminServicesPage section="remote-access"`).
- **Guides des box** (`remoteAccess/routerGuides.ts`) : seulement des pages officielles vérifiées, datées ;
  ce qui n'est pas confirmé vaut `null` (SFR : site fermé à nos outils).
- **Banc de bout en bout** (`apps/server-e2e`, JAMAIS lancé par `pnpm test`) : de vraies piles, un vrai
  Jellyfin (10.11, 12.1), le Chrome du système, Caddy et Traefik (compose PROPRE au banc, `proxies/compose.yaml`, nourri des extraits de l'admin) —
  `pnpm --filter @tentacle-tv/server-e2e test:e2e`, variables dans son README (colima : `E2E_COMPOSE`,
  `DOCKER_HOST`). Ce qui attend un humain : le test réel en 4G (`REAL-TEST.md`) et Linux + Podman + GPU
  (`stacks/tests/linux-podman-gpu.sh`, préparé, pas validé).

## Détection des passages — trois greffons posés par Tentacle, aucune écoute

Intro, résumé, générique : Tentacle les tient de TROIS greffons de Jellyfin
qu'il installe et règle lui-même (`apps/backend/src/services/segmentPlugins/`,
contrat `packages/shared/src/segmentPlugins/`, recopié) — **Intro Skipper** et
**SkipMe.db** (un seul dépôt, `intro-skipper.org/manifest.json`, qui ne sert un
manifeste qu'à l'agent `Jellyfin-Server/x.y.z`), **TheIntroDB** (son dépôt
GitHub, plancher 10.11.6 tenu par nous). Pas « Chapter Segments ». Deux portes,
un moteur : l'assistant (`/api/setup/jellyfin/segments`, première ligne de
« Installation », AVANT les bibliothèques) et « Installer / réparer » de
l'admin (`/api/admin/jellyfin/segment-plugins`, session personnelle). Une
recommandation du tableau de bord (`segmentPlugins`, masquable) si l'un manque.

- **L'analyse AUDIO est RETIRÉE** (2026-10-15, « inutile, et elle perturbe ») :
  Tentacle n'écoute plus rien — ni voisins de saison, ni fin de média, ni
  ffmpeg ou fpcalc dans l'image —, et il n'y a plus d'interrupteur. Son
  analyse de fin de média ne lit que les VIGNETTES trickplay
  (`services/tailAnalysis/`). Un serveur d'avant perd ses clés
  (`audio_analysis_enabled`, `audio_analysis_default_off_applied`) une fois au
  démarrage, journal clair s'il l'avait allumée (`audioAnalysisRetirement.ts`) ;
  la table `media_audio_analysis` part par la migration 0005. La source
  `"audio"` d'un segment reste dans le contrat (verdicts et instantanés
  d'avant) ; `GET /api/admin/audio-analysis` reste FIGÉ (« coupée, sans
  outil ») pour les bureaux livrés, `PUT` n'existe plus. Aucune capacité :
  il n'y en a jamais eu pour elle.
- **L'analyse AUTOMATIQUE d'Intro Skipper reste coupée** — Chromaprint n'a pas
  d'interrupteur à lui (`BaseItemAnalyzerTask.cs`) : `AutoDetectIntros=false`
  et la tâche `IntroSkipperDetectSegmentsTask` sans déclencheur, à chaque
  installation ou réparation. Au retrait, une coupure UNE fois de plus, même
  là où elle avait été rallumée (marque `introskipper_auto_off_final_applied`,
  l'ancienne `introskipper_audio_off_applied` effacée), journal clair si elle
  tournait. Tentacle n'offre aucun moyen de la rallumer ; il ne se bat pas
  contre le panneau du greffon dans Jellyfin.
- **Seule exception à « jamais de redémarrage de Jellyfin »** : ce geste, par
  `POST /System/Restart` (redémarrage DANS le processus, mesuré sous Docker),
  jamais pendant une lecture sauf « Redémarrer maintenant » ; « revenu » = `Id`
  de `/System/Info/Public` PUIS `/Plugins` en JSON (10.11 sert `Id` ~25 s
  avant le reste). Remis à plus tard, un guet de fond règle les greffons dès
  qu'ils sont chargés.
- **Rien de bloquant** : un dépôt muet, un greffon sans version pour ce
  Jellyfin, chacun a son résultat (`repo-offline`, `unavailable`, `too-old`),
  dit en mots simples ; l'installation continue.

## Panne de Jellyfin — un état dit par le serveur, une règle pour les lecteurs

Le backend sait si Jellyfin redémarre, s'arrête ou démarre
(`services/jellyfinHealth*.ts` : annonces de sa socket, puis sonde — deux
échecs font « arrêté ») et le dit à chaque lecteur (`server:jellyfin`, canal
de session, additif). Les lecteurs n'improvisent pas : `outageView` et
`useOutageGate` (api-client) — bandeau, aucune erreur pendant la panne, flux
TOUJOURS rouvert au retour (même position, mêmes pistes, nouvelle session) ;
la TV en fait une sonde qui fait foi (tv-core `serverOutage.ts`). Toute sonde
« Jellyfin est revenu » exige l'`Id` de `/System/Info/Public` : le serveur
d'attente de 10.11 rend un 200 sans `Id` pendant son démarrage (mesuré).
Faits mesurés : `docs/PANNE-JELLYFIN.md`.

## Ajouts en direct — les sockets des comptes, jamais un relevé

Un titre ajouté entre dans « Derniers ajouts » sans changer de page, sur toutes
les plateformes. Jellyfin n'envoie `LibraryChanged` et `UserDataChanged` qu'aux
sessions d'un COMPTE : la socket du serveur (clé d'API) n'en reçoit aucun. Ce sont
les sockets que le canal de session tient pour chaque appareil, au nom de son
compte, qui les reçoivent et les relaient (`services/jellyfinUserEvents.ts`) :
aucune requête au repos — **jamais un relevé rapide** côté serveur. Jellyfin
retient l'évènement `LibraryUpdateDuration` s (30 par défaut, 5 conseillé par
le tableau de bord). Côté client, une carte a pour clé son TITRE
(`rowItemKeys`, shared), jamais sa place ; sur le web la nouvelle entre sous les
yeux (`useRowArrivals`, accroche coupée le temps de l'arrivée). Toute requête
`/Items?Recursive=true` faite avec la clé d'API porte `adminUserParam()` : sans
`userId`, Jellyfin rate les titres ajoutés depuis son démarrage (mesuré, 10.11).

## Plus de serveur — trois cas, jamais un voile là où le hors ligne existe

Sans serveur, une seule règle dit POURQUOI (`packages/shared/src/connectivity/
connectivityCase.ts`) : l'APPAREIL sans réseau (« Vous êtes hors ligne »), le
serveur Tentacle muet ou trop lent (« Le serveur Tentacle est hors ligne »),
Jellyfin injoignable derrière un Tentacle qui répond. Jamais « ce n'est pas
votre faute ». Le mobile et le bureau ne montrent AUCUN voile : ils passent en
mode hors ligne quelle que soit la cause, même sans titre gardé, et un message
TEMPORAIRE le dit (`useConnectivityNotice`, api-client : une fois par bascule
ou changement de cause, compte à rebours, jamais sur le lecteur). Le web, la
TV LG et l'Apple TV / Android TV gardent leur écran, avec ces mêmes mots ; la
TV demande à la page de connectivité du système si elle a un réseau
(`deviceNetworkProbe`, seulement après un échec du serveur, gardé 15 s).

## Transcodage — le moteur déclare, la règle décide

Aucun client ne choisit « h264 + aac » lui-même : il déclare ce que son MOTEUR décode
(`packages/shared/src/playback/engineCapabilities.ts` — mpv, AVPlayer, ExoPlayer, repli
sûr), et `planStream` / `engineTranscodingProfiles` (shared) en tirent codec de sortie
(HEVC en tête, l'admin Jellyfin garde la main), plages HDR/DV, copie du son et budget.
Faits mesurés, à ne pas redécouvrir (`docs/TRANSCODAGE-MOTEURS.md`) : le son n'est copié
que si `AudioBitrate` couvre la piste ; `AudioCodec` ≤ 40 caractères ; **tout réencodage
d'une source HDR sort en SDR** (Jellyfin, même en HEVC) — le HDR et le Dolby Vision ne
survivent qu'à une COPIE, jamais avec un `MaxWidth` sous la source ; l'épisode suivant
refait la mesure du débit (`itemBitrate.ts`). Tableau de bord : un `Transcode` sans
`TranscodingInfo` est « En analyse », jamais un transcodage présumé.
**Android TV déclare d'après l'APPAREIL** (`deviceMediaProfile` relevé par le module
natif, `exoPlayerEngineFor` / `mpvEngineFor`, verdict `devicePlaybackVerdict`) : jamais
le décodage logiciel d'une image ; l'AV1 sans décodeur est converti par le serveur, et
le lecteur le dit. Profil simulé du banc : `debug.tentacle.media_profile` (app `.perf`).

## Watch Together — partagé, et PAR APPAREIL

Le web, le bureau et le mobile ne rendent que l'INTERFACE : règles pures dans
`packages/shared/src/watchTogether/` (état de salle et ses effets, « tous
prêts », reprise planifiée ; la dérive dans `player/driftController.ts`),
crochets sans DOM dans `packages/api-client/src/watchTogether/` — la séance
d'un appareil (`useWatchTogetherSession(port)` → `WatchTogetherContext`), le
moteur de synchronisation (`engine/`), le décompte de saut, le chat,
l'affinité. Un lecteur se branche par le PORT `WtPlayerPort` (positions en
secondes FILM, atterrissage du transcodage compris). Carnet :
`docs/WATCH-TOGETHER-SYNC.md`.

- **L'adhésion est PAR APPAREIL** (serveur 1.31.1, `watchTogether.deviceMembership`) :
  un appareil = le hash de son jeton. Seuls les appareils LIÉS (créé, invitation
  acceptée, « Rejoindre ici ») reçoivent la séance ; un autre appareil du même
  compte n'en a que l'avis `wt:elsewhere`, ne fait rien quitter, et peut s'y
  AJOUTER (`POST /group/join-here`). Tout nouvel envoi de la séance passe par
  `sendToMember` / `sendToRoom` (`memberDevices.ts`), jamais `sendToUser`.
  Carnet : `docs/WATCH-TOGETHER-APPAREILS.md`.
- **L'arrivée met la salle en pause AU CLIC** (invitation acceptée, « Rejoindre
  ici » : `arrival.ts`, par appareil, borne 15 s) ; le nouveau s'ouvre à la
  position de la pause, la position d'un lecteur qui n'a rien lu ne déplace
  jamais la salle. « Rejoindre » d'un membre du groupe : `joinPlayback` →
  `POST /group/arrive`, même pause au clic. Un arrivant n'est jamais « tous
  prêts » : aucun passage ni enchaînement tant qu'il n'est pas là. Arrivée et
  départ de la LECTURE se disent par la règle commune `roomNotices.ts`.
- **Aucun saut de passage avant « tous prêts »** (`watchTogether.readyGate`,
  `allReady`) : ni bouton, ni décompte, ni enchaînement (`groupHold` de
  `findSkipCandidate` / `autoNextEligible`, `groupSkipHeld` de la coquille de
  lecture) ; ensuite le clic est un `wt:seek` (barrière), l'auto-saut un
  décompte serveur.
- **Le mobile** n'a Watch Together qu'avec `watchTogether.deviceMembership` ;
  sans elle, sa séance reste éteinte (`WtPlatformPort.enabled: false`).
- **Le chat est interactif** : débit par seau à jetons PARTAGÉ client/serveur
  (`watchTogetherChat.ts` — jamais un intervalle minimal entre deux envois),
  rafales d'emojis regroupées à l'affichage, « est en train d'écrire »
  derrière `watchTogether.typing`. Un saut relatif part de la cible déjà
  demandée, et chaque `wt:seek` porte son `seekToken` (sauts rapides).

## Préconfiguration de la barre (TV) — par profil, sur l'appareil

Apple TV et Android TV : chaque profil choisit UNE fois, sur CET appareil, les bibliothèques
épinglées dans le rail et leur ordre (route `RailSetup`, avant l'accueil). Rien côté serveur,
aucune capacité ; ni web, ni bureau, ni mobile.

- **Le rail est PAR PROFIL** (tv-core `nav/railProfileStore.ts`) : clé fixe
  `tentacle_tv_rail_profiles` = `{ [userId]: { masquees, order?, setupDone? } }`, l'identité
  active = l'`Id` de `tentacle_user`. Un profil sans entrée HÉRITE de `tentacle_webos_rail`
  (la disposition de l'appareil, que la LG lit encore : jamais réécrite) — rien ne bouge à la
  mise à jour. `useRailPinning()` garde son API : Réglages › Navigation édite le profil actif.
- **Due** (`decideRailSetup`, `isRailSetupPending`) : pas encore faite ET au moins DEUX
  bibliothèques (`/UserViews` du profil : ses droits Jellyfin, rien d'autre) ET en ligne ;
  attente bornée à 5 s ; décision TENUE par identité (jamais une page sur un accueil affiché).
  Dernier nombre de bibliothèques vu : `tentacle_tv_rail_libraries`, pour choisir la route
  d'arrivée sans détour (`railSetupPending()`, synchrone).
- **Place au démarrage** : après le choix du profil et son PIN, avant les nouveautés, jamais
  par-dessus « accès suspendu ». Retour = « Passer » (marquée faite, disposition gardée).
- **Le propriétaire** applique sa disposition à d'autres profils de la famille sur cette TV
  (`applyLayoutTo`, étape après « Continuer » et Réglages › Navigation) : copie des masquées et
  de l'ordre ; une bibliothèque que le profil ne voit pas n'apparaît pas chez lui.
- Vue `redesign/screens/railSetup/`, câblage `redesignWiring/railSetup/`, règles
  `nav/railSetup*.ts` ; le banc nav-golden marque la préconfiguration faite pour ses comptes.

## Navigation TV — une seule source

L'Apple TV refondue est la référence de la navigation. Ce qui DÉCIDE — focus,
voisins, entrées, Retour, appui maintenu, raccourcis, lecteur, panneaux — vit
dans `packages/tv-core`, en trois couches : les INTENTIONS (`remote/intents.ts` :
aller vers, valider, maintenir, revenir, lecture/pause, glisser), les TABLES de
traduction de chaque télécommande (`remote/bindings/tvos.ts`, des données), et
les COMPORTEMENTS purs, rangés dans le dossier de domaine qui en parle
(`focus/`, `nav/`, `player/`, `cards/`, `panels/`, `input/`). L'adaptateur tvOS
(`apps/tv/src/platform/tvos/` : `input/`, `focus/`, `back/`, `player/`,
`panels/`…) ne fait qu'APPLIQUER : guides de focus, préférences, sections
natives, `MenuPressInterceptor`. **Android TV est branché** (bascule du
2026-10-05 : l'ancienne UI n'existe plus) : sa table
(`remote/bindings/androidtv.ts` — pas de pavé, Retour au lieu de Menu, OK puis
OK pour la pause sans touche Lecture/Pause) et son adaptateur
(`apps/tv/src/platform/androidtv/`, variantes `.android.ts`) appliquent les
MÊMES comportements ; seuls changent les indications de touches et le verre
(Liquid Glass éteint, réglage masqué). Contrat et règle de rangement :
`docs/TV-NAVIGATION.md` ; Android : `docs/tv-navigation/android.md` et
`android-focus.md` ; ce qui reste, ligne à ligne :
`docs/tv-navigation/inventaire.md`.

- **Une règle lit des intentions et des traits, jamais un `eventType` ni
  `Platform.OS`** : module pur, horloge injectée, ni React ni React Native
  (`packages/tv-core/src/purity.test.ts` le vérifie).
- **Un seul abonnement natif à la télécommande** : `platform/tvos/input/`
  (Android : `platform/androidtv/input/`, même API). On
  y observe une intention (`useRemoteIntents`) ou on y inscrit un contexte
  (`useRemoteContext`) — jamais un `TVEventHandler` de plus.
- **L'adaptateur n'a ni seuil ni durée** : ce qui décide va dans tv-core
  (l'audit liste ce qui y traîne).
- **Le lint le tient, en ERREUR** (`eslint/tvNavigation.mjs`) : hors de
  `platform/tvos/` et `platform/androidtv/`, le chemin refondu n'emploie aucune API native de
  télécommande ni de focus. Les exceptions sont explicites, par famille, et
  justifiées (`eslint/tvNavigationExceptions.mjs`) ; jamais un `eslint-disable`.
  Audit : `node eslint/tvNavigationAudit.mjs`.
- **Android TV se prouve contre l'Apple TV** : `nav-golden.mjs verify
  --android` rejoue les scénarios tvOS à l'émulateur et compare aux MÊMES
  références (jamais de référence Android) ; `player-trace` en
  `TRACE_PLATFORM=androidtv`, `back-trace` (« android refondu ») de même.
- **Brancher une autre plateforme** (webOS, le jour venu) : sa table
  (`remote/bindings/<plateforme>.ts`), son adaptateur
  (`apps/tv/src/platform/<plateforme>/`), la portée du lint étendue à son
  chemin. Aucun comportement à réécrire : ceux de tv-core sont déjà les siens.

## Garder hors ligne, application quittée — le serveur prépare, le système transfère

Un titre gardé hors ligne va au bout application quittée ou téléphone verrouillé
(carnet : `docs/HORS-LIGNE-FOND.md`). Trois règles à ne pas défaire :
- **L'Allégé se prépare sur le SERVEUR** (capacité `offline.serverPrepare`,
  `/api/downloads/prepared/:itemId`, `services/offlinePrepare/`) et se lit PENDANT qu'il
  s'écrit ; reprise par plage seulement pour l'appareil qui l'a déjà lu (`?tag=`) ; le
  téléphone l'efface (`DELETE`) à l'arrivée ou à l'annulation, jamais à une pause ; push
  silencieuse iOS `offline:prepared` quand elle s'achève sans lecteur. Sans la capacité :
  `/light`, comme avant.
- **Le média est remis au pilote AVANT les à-côtés** (`worker.ts`), et une coupure réseau se
  relance SEULE (`NETWORK_RETRY_DELAYS_MS`, relances immédiates sur l'iPhone derrière) —
  jamais une pause qui attend le premier plan.
- **Android : service de premier plan gardé au balayage, et tâche headless
  `TentacleOfflineTransfers`** tant que le moteur s'occupe (sans elle, RN gèle tous les
  minuteurs en arrière-plan) — « s'occupe » = `onHeld` (`engineHold.ts`) : en vol OU une
  relance programmée, jamais `onBusy` seul (une playlist d'Octave qui attend l'extension n'a
  rien en vol). Bureau : la fin des transferts fenêtre fermée tient sur `awaitingServer`.
- **La musique d'Octave n'a pas `serverPrepare`** (son `source_path` dit d'où tirer) : un titre
  d'extension qui se prépare répond 503 + `Retry-After`, et c'est le SERVEUR qui réveille l'iPhone
  à l'heure dite (`services/offlinePrepare/extensionWaitWake.ts`, même push `offline:prepared`) ;
  la fin des transferts remis réveille aussi la file (`ios/SessionWake.swift`).

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

### Mobile — le mot « téléchargement » ne s'écrit nulle part

Zéro occurrence de **téléchargement, télécharger, téléchargé, download** dans
un texte que l'utilisateur du mobile peut lire. Les relecteurs d'Apple ouvrent
ces écrans, et le mot y désigne pour eux une distribution de contenu hors
boutique — la confusion coûte un rejet. Le vocabulaire de remplacement est déjà
posé : « garder hors ligne », « sur cet appareil », « transfert », « préparer »,
« sur le téléphone ». Sa source est l'espace de noms `offline`
(`packages/shared/src/i18n/locales/{fr,en}/offline.ts`), dont l'en-tête porte la
même consigne ; toute clé fautive y a son équivalent.

Concrètement : le mobile lit `offline` en priorité, et ne réutilise de
`downloads` — l'espace du web et du bureau, où le mot reste légitime — que les
clés qui ne le contiennent pas. Une chaîne visible en dur ne déroge pas.

Ne sont PAS concernés (rien de tout cela ne s'affiche) : les noms d'icônes
Feather (`download`, `download-cloud`), les statuts de base (`downloading`), les
noms d'évènements du moteur (`downloads://changed`), les chemins et les
identifiants de code. Les renommer ne gagnerait rien et casserait l'exécution.

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
placement (GNOME, wlroots) → en `auto`, **XWayland tant qu'aucun écran HDR n'est
branché** (EDID, `linux/edidHdr.ts` ; décision du 2026-10-22 : le bouton plein
écran y était annulé par l'épingle, « cassé » sur Fedora 44), sinon HDR réel et
lecture plein écran forcée ; X11 → lecture fenêtrée à la main, pas de HDR. Un
XWayland-auto qui n'affiche pas se bloque seul (`sessionRescue.ts`). Un réglage
force Wayland/X11 (relance).

Cinq conséquences à ne pas défaire :
- **`transparent: true` à la CONSTRUCTION** de la fenêtre (comme macOS, PAS comme
  Windows). Mesuré : posé à l'exécution, la page peint du noir sur la vidéo.
- **`target-colorspace-hint=yes`** sans condition sur Wayland. `auto` n'y décide
  de rien (mpv#16305) et `no` supprime la transmission.
- **Un compositeur est nécessaire sous X11.** Sans composition, X11 ne mélange
  pas le canal alpha et l'overlay masque la vidéo.
- **La colle ne rend JAMAIS l'activation à un hôte réduit** (`kwinGlueTemplate.ts`) :
  `activateWindow` dé-réduit ce qu'il active, et KWin passe le focus à mpv
  PENDANT la réduction — la réduction s'annulait elle-même. Pendant la lecture,
  c'est la fenêtre mpv qui représente l'app dans Alt+Tab (la vignette n'y rend
  qu'UNE fenêtre) ; son titre vide veut dire « garée ».
- **mpv est préchauffé et reste chaud sur le montage collé**
  (`ipc/videoPrewarm.ts`, `video/mpvPark.ts`) : `vkCreateDevice` coûte ~550 ms
  sur NVIDIA, par instance (~390 sans la file de calcul, coupée sur NVIDIA).
  Une instance MINCE naît d'avance (91 Mio, la page l'envoie avec les options
  MÊMES de `mpv_init`, sinon rien n'est repris) ; après une lecture, l'instance
  chaude reste 60 s puis est recyclée — gardée, elle retiendrait jusqu'à 2 Go
  de VRAM. Rien sur batterie ni à travers une veille. Et hors Windows, aucune
  lecture ni écriture SYNCHRONE de propriété mpv — elles retiennent le thread
  principal le temps du montage vidéo (`mpvProperties.ts`). Mesures :
  `docs/LINUX-FENETRE-VIDEO.md`, « Le démarrage, mesuré » et « deuxième passe ».

**Le PiP (Linux, colle KWin)** : là où la coquille expose `pip_open`, le lecteur est
rendu par `PlayerStage` HORS des routes (la route `/watch` n'y rend rien) — c'est ce
qui le fait survivre à la navigation ; une navigation demandée par le lecteur passe par
`usePlayerNavigate` (pendant le PiP, l'épisode suivant y reste, toute autre sortie le
ferme) ; une lecture lancée depuis l'application PENDANT le PiP — fiche, carte, autre
titre — s'y joue et le PiP reste ouvert, comme sur YouTube (`PlayerStage` : la page rend
aussitôt celle qu'on parcourait). Seuls « Quitter » et le retour au lecteur le ferment. La fenêtre PiP est ouverte par la page (`window.open`, portail React) et
fabriquée par la coquille ; la colle la reconnaît à son TITRE (`pip/pipCaptions.ts`,
jamais traduit). **Jamais `app-region: drag` dans le PiP** : Electron n'y transmet plus
RIEN à la page (ni survol, ni molette, ni double-clic) — glisser et tirer un coin sont
des gestes que la page annonce dans ce titre et que la colle exécute en suivant le
curseur (`glueQml/pipGestureQml.ts`). La vidéo est collée DANS le cadre de la fenêtre PiP
(`pip/pipFrame.ts` : liseré opaque qui arrondit les coins de mpv, marge d'ombre).
Les mouvements ANIMÉS (entrée depuis l'image du lecteur, retour, molette) sont joués par la colle
(`glueQml/pipMotionQml.ts`), demandés par le même titre (`[enter 280]`, `[restore 220]`, `[size L H 120]`),
sur les règles de `pip/pipMotion.ts` que la coquille applique ailleurs ; ils partent de la géométrie DEMANDÉE
(`pipRect`), jamais de `frameGeometry` relue — sous Wayland elle arrive en retard.
La vidéo passe en plein écran AVEC l'hôte (règle « plein écran actif »
de KWin, écran par écran) ; un script KWin se lance par `run` PUIS `Scripting.start`
(KWin réattribue les identifiants). Détail : `docs/LINUX-FENETRE-VIDEO.md`, « Le PiP ».

Le verdict HDR se lit sur le COUPLE `video-params` / `video-target-params`, jamais
sur l'un des deux : sur un écran laissé en HDR, un contenu SDR sort lui aussi en
PQ. Relevé complet : `docs/LINUX-FENETRE-VIDEO.md`.

### macOS — deux montages vidéo, choisis par la machine

Apple Silicon : mpv ouvre SA fenêtre Metal (`gpu-context=macvk`), calée sous la
nôtre — le seul chemin HDR mesuré. Intel : mpv dessine par la Render API OpenGL
dans une `NSOpenGLView` de NOTRE fenêtre (`vo=libmpv`), la chaîne de l'ancienne
coquille Tauri — une fenêtre, pas de MoltenVK, VideoToolbox zéro-copie par
`CGLTexImageIOSurface2D`. La décision est `decideMacosMontage` (`process.arch`),
forçable par `TENTACLE_VIDEO_MONTAGE=gl|fenetre`. Sur Intel, le montage Metal
chauffait (mpv#12675 : import zéro-copie en échec, donc décodage logiciel en
silence) pour un HDR qu'aucun écran Intel intégré n'affiche. `hwdec` macOS est
une liste (`videotoolbox,videotoolbox-copy`) : jamais de repli logiciel silencieux.
Aucun réglage exposé — un seul mode. Relevé : `docs/MACOS-FENETRE-VIDEO.md`.
**Le PiP (Apple Silicon seulement)** : la fenêtre Metal de mpv CHANGE DE PARENT — de la
nôtre à la fenêtre PiP et retour (`video/macosPipParent.ts`), sans que mpv le sache : HDR
et lecture gardés. La coquille y fait ce que la colle fait sous Linux — placement, modes,
gestes suivis au curseur (`pip/pipShell.ts`, règles communes `pip/pipPlacement.ts`) ; le
chemin Linux (titre lu par la colle) ne change pas. Relevé : même fichier, « Le PiP ».
**Windows** : la fenêtre fille de mpv change de parent par `SetParent` (`video/videoWindow.ts`) —
mpv suit seul son nouveau parent (crochet sur le thread de sa fenêtre parente) ; PiP sans
cadre dessiné (`pipFrame.ts` : fenêtre rendue transparente à l'exécution, jamais fabriquée
`transparent`), ancré = fenêtre POSSÉDÉE (`setParentWindow`).

### Liquid Glass (bureau macOS 26) — une porte, deux verres

Le bureau 1.40.0 prend le verre de macOS 26 ; carnet complet : `docs/LIQUID-GLASS.md`. **La cible est
Apple (HIG « Materials »), jamais le « glassmorphisme »** — refonte du 22/10 après le verdict
« ignoble » sur un premier verre sombre, très flou, à liseré gris, et un lecteur en dalle.

- **Une seule porte : `<html data-liquid-glass="native">`** (`theme/liquidGlassMode.ts`, posée
  avant le premier rendu) — le pont de la coquille dit le système capable
  (`window.tentacle.liquidGlass.supported`) ET le réglage est allumé (Réglages › Apparence, allumé
  d'office, `tentacle_liquid_glass`). Toute règle qui lit `var(--lg-…)` ou `.lg-…` est portée par
  `:root[data-liquid-glass="native"]` (`liquidGlassTokens.test.ts`) : web, Windows, Linux, macOS < 26,
  réglage coupé gardent le RENDU D'AVANT au pixel près. L'option n'existe pas sur un macOS < 26.
  Fonction purement client : aucune capacité serveur.
- **Deux verres.** Sur la VIDÉO, le vrai `NSGlassEffectView` (classe PUBLIQUE d'AppKit) par le pont
  koffi du lecteur (`apps/desktop-electron/src/main/liquidGlass/`) — jamais `electron-liquid-glass`,
  jamais une API privée (refus du Mac App Store ; `privateApi.test.ts`). Lecteur seulement, et sur
  Apple Silicon seulement (`refractsVideo`, montage `fenetre` ; Intel garde l'habillage d'avant) :
  de PETITES capsules `clear` séparées (10 px, au-delà de la fusion), qui se MATÉRIALISENT
  (lot lg8 : montée de 6 px, verre qui s'allume, formes décalées, sortie plus rapide ; chaque
  forme son conteneur natif ; `playerGlassMaterialize.ts` → coquille ET CSS), ATTÉNUÉES comme chez QuickTime — un noir à alpha de la page DANS
  la forme, dosé par le ton mesuré (`playerGlassDim.css` : 0,65 clair, 0,5 sombre), glyphes
  toujours blancs ; le verre normal (panneaux) s'adapte seul. ⚠️ Fenêtre ACTIVE, le verre
  natif est bien plus clair qu'inactive (87 contre 33 sur du noir) : un banc sans focus ne
  juge que l'inactif (`bench/liquid-glass/lg3/`). Sur la PAGE, la
  LENTILLE de Chromium : le verre natif vit SOUS la vue web et ne voit pas la page — jamais une
  région native qui défile avec elle.
- **La lentille** (`@tentacle-tv/ui` glass/`lensProfile`, `refractionMap`) : presque transparente,
  givre faible, réfraction PHYSIQUE au biseau (Snell, rien au centre) calculée pour la forme exacte ;
  le bord ÉCLAIRCIT le fond réfracté (`fond × (1 + gain)`) — jamais un trait ni un contour blanc.
  `backdrop-filter: <givre…> url(#lentille)`, les fonctions AVANT `url()`.
- **Ton du dessous, mesuré** : `liquidGlass.sample(rects)` (luminance médiane sous chaque rectangle :
  la page, et là où elle est transparente l'image décodée de mpv dessous — macOS, montage `fenetre`,
  une capture par seconde au plus, hors du fil principal ; `under: "window"` : la vidéo SEULE, page
  exclue, pour une forme posée dessus) → `useBackdropTone` → `data-lg-tone="dark|light"` :
  glyphes (`--lg-glyph*`), lumière du bord, reflet et DANGER (`--lg-danger-on-*`) en suivent ;
  hystérésis, un appel par 250 ms au plus. Menus et feuilles : un ton PAR BANDE (`bands`,
  `data-lg-band`) et, sur un dessous moyen seulement, un voile minimal calculé. Jamais un fond
  sombre pour lire : `--lg-clear-dim` et `--lg-media-dim` sont transparents (la page ; sur la vidéo, l'atténuation du lecteur ci-dessus).
- **Jetons `--lg-*`** dans `theme/liquidGlassTokens.css` (clair ET sombre ; pas `tokens.css`, que
  l'admin surcharge) ; les familles composent sans redéfinir (`--lg-chrome-*`, `--lgc-*`,
  `--lg-player-*`, `--lg-spring-*`). **Primitive** `theme/glass/` (`LiquidGlass`,
  `useLiquidGlassSurface`, `useLiquidGlassRegion` ; bouton : `components/ui/glass/PressableGlass`) :
  hors `native`, `className` +
  `fallbackClassName` et rien d'autre. Petites formes qui flottent (la barre en GROUPES), teinte de
  marque DANS le verre pour l'action principale seule (`prominent`).
- **Le labo `/dev/verre`** (`dev/glassLab/`, paquets de développement seulement, absent des paquets
  livrés et du client LG) : chaque surface sur de vrais dessous — on y juge un verre AVANT de le
  propager.
- **Une modale ou un menu `fixed` passe par un PORTAIL** : un `backdrop-filter`, un `transform` ou
  le `scale` de la lentille en font le bloc conteneur (vécu : « garder hors ligne » coincé dans
  240 × 54 px ; `modalPortal.test.ts`). Jamais de lentille (`data-lg-lens`) sur un verre natif.
- **GPU** : les règles ci-dessous valent double — toute image qui change SOUS un verre en refait le
  flou et la réfraction. Le travelling du héros est joué par le COMPOSITEUR (`@keyframes` de
  `transform` en `steps()`, `theme/heroMotion.css` : 60 % → 20 % du GPU d'Electron), la rotation des
  bannières seulement à l'écran ; contrôles du lecteur masqués = 0 région native.
- **Budget de LENTILLES** (lot lg5, décision de Damien du 23/10) : une lentille coûte ~0,3-0,45 ms de
  dessin GPU par image redessinée QUELLE QUE SOIT sa taille (le coût suit la fenêtre) ; à 20 sur un
  dessous qui bouge, une image sur deux est perdue. Au plus 8 visibles (`LENS_BUDGET`, `gpuBudget.ts`,
  `useLensBudget` dans la primitive et `useGlassControl`) : au-delà, les moins prioritaires (surface >
  barre > contrôle, puis taille) restent du givre. Un groupe posé sur un dessous animé renonce à la
  sienne (`GlassLensScope lens={false}` : les 4 petits ronds de la bannière de l'accueil ; « Lecture »
  et « Plus d'infos » gardent la leur). Un nouveau verre
  à lentille se compte : `node perf/census.mjs /route` (banc de fluidité, `bench/liquid-glass/perf/`).
- **Bancs** : `TENTACLE_LIQUID_GLASS=off` simule un Mac sans verre (pont absent, option
  invisible) ; `TENTACLE_BENCH_INACTIVE=1` ouvre la fenêtre sans voler le focus (jamais un banc
  sous les doigts de l'utilisateur) ; recette `apps/desktop-electron/bench/liquid-glass/` (README) ;
  coût de la lentille `apps/web/bench/glass-gpu/` (page et application réelle, `app-lens.mjs`).

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

4. **Une fenêtre `transparent` n'a pas d'ombre (macOS).** macOS calcule l'ombre
   d'une fenêtre transparente depuis son masque alpha, à CHAQUE recomposition —
   dès que quoi que ce soit bouge derrière ou dedans. Mesuré sur un build de
   production, app au repos sur l'accueil : 72 % d'utilisation GPU avec
   l'ombre, 19 % sans — plus que la lecture d'un film. `hasShadow: false` à la
   fabrication (`macosTitleBar.ts`), et rien ne la rallume.

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
| Backend | Fastify 5, Prisma 6, SQLite (moteur natif de Prisma, une connexion) |
| Data | TanStack Query v5 |
| Video | hls.js 1.6 + HTML5 `<video>` (web), react-native-video (mobile/TV) |
| i18n | i18next + react-i18next (FR/EN) |
| Validation | Zod 3.24 |
| TypeScript | 5.7, strict mode, ES2022 target |
