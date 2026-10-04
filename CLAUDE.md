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

# Livrer — voir « Livraison » plus bas. RIEN ne part d'un push :
# tout passe par un déclenchement de workflow, depuis « Tentacle Deploy.html ».
gh workflow run server.yml -f channel=store   # le serveur, par exemple
```

> Le remote `production` n'existe plus. `origin` (GitHub) est le seul.

## Livraison (CI)

**Source unique des versions : `versions.json` (racine)** — champs `desktop`,
`tv`, `webos`, `mobile`, `server`, `minServer` (version serveur minimale exigée
par les clients — bannière de compat `useServerCompat.ts`). On change la version
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
`version`, `promote`) — et `webos.yml` comme `server.yml` n'ont NI `targets` NI
`promote` (`noTargets` / `noPromote` dans la page). Une entrée qu'un workflow ne
déclare pas fait REFUSER le déclenchement (422 « Unexpected inputs provided ») ;
une entrée déclarée que la page n'envoie plus prend son défaut, en silence.

### Les trois crans

| `channel` | Ce qui se passe |
|-----------|-----------------|
| `build` | Construit et archive les artefacts. **Rien ne part nulle part.** |
| `test` | Piste Play FERMÉE en `completed` · TestFlight distribué au groupe externe · Linux en pré-version · serveur en `:vX.Y.Z` sans bouger `:latest` · webOS sans toucher `webos-latest`, image en `:vS-webos-X.Y.Z` sans bouger `:latest`. **Publié, sans aucun geste ensuite.** |
| `store` | Production Play à 100 % · App Store soumis à l'examen avec mise en vente automatique · Microsoft Store · Release GitHub publiée et manifeste d'auto-update patché · `:latest` basculé (par le serveur OU par webOS). **En ligne, sans un clic de plus.** |

`promote` (le défaut au cran store) reprend **le binaire déjà testé** au lieu
d'en reconstruire un autre. Windows fait exception : le Microsoft Store exige le
paquet à chaque soumission. Une cible sans RIEN de testé pour cette version se
construit : `prepare` le vérifie avant le moindre job (`promote-probe.mjs`), au
lieu de laisser la reprise échouer pendant que Windows part seul au Store.

### Les cinq workflows

| Workflow | Cibles (`targets`) |
|----------|--------------------|
| `desktop.yml` | `macos` · `windows` · `linux` |
| `mobile.yml` | `android` · `ios` |
| `tv.yml` | `androidtv` · `appletv` |
| `webos.yml` | aucune entrée `targets` — l'IPK ET le client servi sous `/tv` |
| `server.yml` | aucune entrée `targets` — l'image Docker EST le serveur |

Les tags `<plateforme>-vX.Y.Z` restent acceptés comme déclencheurs et valent le
cran `store` ; c'est la CI qui les pose quand on demande une version. Un sixième
fichier, `server-image.yml`, ne se lance pas seul : c'est le workflow
RÉUTILISABLE qui construit et publie l'image Docker pour les deux derniers.

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

`changelogs/{desktop,tv,server,mobile,webos}.md`, blocs `## [X.Y.Z]` avec
`### FR` / `### EN`. Limites appliquées (`lib/changelog.mjs`) : ASC 4000,
MS Store 1500, Play 500 **caractères Unicode**. Les blocs par canal
`## [mac-X.Y.Z]` et `## [win-X.Y.Z]` remplacent le bloc nu pour ces cibles-là.
`CHANGELOG.md` racine = archive pure.

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
  les pistes par form factor sont PRÉFIXÉES dans l'API (`tv:Alpha` ≠ `alpha`), le
  versionCode TV vaut `2e9 + build`, et les deux workflows partagent un groupe de
  concurrence — deux éditions Play concurrentes s'invalident l'une l'autre.

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
python3 brand/generate-svg.py brand      # les 19 SVG + 3 modules TS
python3 brand/generate-icons.py --write  # les 90 binaires (aperçu sans --write ;
                                         #  un mot en plus = filtre de chemin)
pnpm --filter @tentacle-tv/tv-webos icons  # webOS, à part — voir plus bas
```

`generate-svg.py` écrit aussi les constantes consommées par les clients :
`apps/web/src/components/ui/tentacleArmPaths.generated.ts` et
`tentacleArt.generated.ts` pour la TV et le mobile. Les bras sont des spirales
échantillonnées — elles ne se recopient pas à la main, et trois copies auraient
divergé. Côté natif les `dasharray` sont en unités RÉELLES de tracé :
`pathLength` n'existe que dans le rendu web de react-native-svg.

Quatre pièges déjà payés :

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
  film, rangée « À demander » de la recherche) est une carte grisée
  (`card.absent`, `AbsentArtwork`) ; sa demande ne passe que par
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
`CardSheetProvider` → la feuille), l'appui MAINTENU sur TV. **Sur Apple TV, rien
ne se fait sur la carte** (refonte, `apps/tv/src/redesign/`) : au focus, elle
grandit et garde ses marqueurs — note, épingle Ma liste · j'aime · vu,
progression — et dit sous sa légende, discrète, « Maintenir OK : plus
d'options » (`CardFocusFooter`, sur toute carte qui s'ouvre par l'appui maintenu
: c'est le seul chemin vers ses actions). L'appui maintenu ouvre le GRAND
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
valent plus que pour Android TV et webOS (`TVCardActionSheet`,
`CardActionSheetTv`), pas encore portés, qui gardent les marqueurs au focus. Sur
tvOS, la cible d'une carte (`CardShell`, `FocusTarget form="card"`) couvre son
image ET sa légende mais ne porte que l'IMAGE ; la légende est dessinée avant
elle, dessous, hors de son sous-arbre. Jamais un frère qui dessine PAR-DESSUS la
cible : tvOS ne focalise jamais un élément RECOUVERT par ce qui dessine — la
recherche géométrique ne le propose plus (régression payée : plus une carte
atteignable). Seule l'image suit le pouce (parallaxe native de la vue
focalisée), la légende ne s'incline jamais. État et gestes : `useCardToggles`,
`useCardRatingTarget`, `useCardFace` (api-client). Une feuille qui garde un
instantané de sa carte lit la fiche `["item", id]`, que les mutations patchent.

**Qualité au focus (Apple TV).** Quand le focus d'une carte a tenu 300 ms, la
qualité du titre se pose DANS l'image, en bas à droite, sur la rangée de la note
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
film, rangée « À demander » de la recherche, feuille des saisons
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
démonstration de la revue Apple) → aucune trace.

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

## Aide — un guide, une source ; un rappel, jamais une bannière

Le guide « Bandes-annonces » (`/help/trailers`, `#admin` pour la partie
administrateur) n'a qu'UNE source : sa structure dans
`packages/shared/src/help/trailerGuide.ts`, ses mots dans l'espace i18n
`trailerHelp` (lu par le mobile : son garde-fou refuse « téléchargement »).
Le web, le bureau, le miroir et le mobile le rendent ; les téléviseurs n'en
disent qu'une phrase qui renvoie vers eux — rien de focalisable sur la fiche.

Le rappel de la fiche (« Vous ne voyez pas les bandes-annonces ? ») suit une
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
- **Gestes personnels** (accepter, refuser, quitter, son PIN, dissoudre) :
  jeton Jellyfin du web, du bureau, du mobile seulement — jamais une TV, un
  profil de TV ni « voir en tant que ».
- **Un invité n'apparaît dans AUCUNE liste** (Watch Together, candidats,
  utilisateurs, admin, classement, recommandations en fond) ; seulement dans
  les sessions en cours (`familyGuestOf`). Toute nouvelle liste de comptes
  passe par `withoutFamilyGuests` (`familyGuestMarkers.ts`), la seule source.
- **Une session de profil regarde, elle n'administre rien** (ni push, ni
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
natives, `MenuPressInterceptor`. Contrat et règle de rangement :
`docs/TV-NAVIGATION.md` ; ce qui reste, ligne à ligne :
`docs/tv-navigation/inventaire.md`.

- **Une règle lit des intentions et des traits, jamais un `eventType` ni
  `Platform.OS`** : module pur, horloge injectée, ni React ni React Native
  (`packages/tv-core/src/purity.test.ts` le vérifie).
- **Un seul abonnement natif à la télécommande** : `platform/tvos/input/`. On
  y observe une intention (`useRemoteIntents`) ou on y inscrit un contexte
  (`useRemoteContext`) — jamais un `TVEventHandler` de plus.
- **L'adaptateur n'a ni seuil ni durée** : ce qui décide va dans tv-core
  (l'audit liste ce qui y traîne).
- **Le lint le tient, en ERREUR** (`eslint/tvNavigation.mjs`) : hors de
  `platform/tvos/`, le chemin refondu n'emploie aucune API native de
  télécommande ni de focus. Les exceptions sont explicites, par famille, et
  justifiées (`eslint/tvNavigationExceptions.mjs`) ; jamais un `eslint-disable`.
  Audit : `node eslint/tvNavigationAudit.mjs`.
- **Un fichier partagé avec Android TV** ne s'amincit sur tv-core qu'avec un
  banc qui prouve l'équivalence Android (`apps/tv/harness/back-trace/`,
  `player-trace/`) ; sinon, un adaptateur Apple TV à part.
- **Brancher une plateforme** (Android TV, le jour venu) : sa table
  (`remote/bindings/<plateforme>.ts`), son adaptateur
  (`apps/tv/src/platform/<plateforme>/`), la portée du lint étendue à son
  chemin. Aucun comportement à réécrire : ceux de tv-core sont déjà les siens.

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
placement (GNOME, wlroots) → HDR réel, lecture plein écran forcée ; X11 →
lecture fenêtrée à la main, pas de HDR. Un réglage force Wayland/X11 (relance).

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
| Backend | Fastify 5, Prisma 6, MariaDB 11 |
| Data | TanStack Query v5 |
| Video | hls.js 1.6 + HTML5 `<video>` (web), react-native-video (mobile/TV) |
| i18n | i18next + react-i18next (FR/EN) |
| Validation | Zod 3.24 |
| TypeScript | 5.7, strict mode, ES2022 target |
