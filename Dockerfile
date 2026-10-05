# syntax=docker/dockerfile:1
# La ligne ci-dessus garantit un frontal qui connaît les contextes nommés
# (`--build-context`), quel que soit le moteur Docker qui construit.
#
# DEUX MOITIÉS, DEUX LIVRAISONS. L'image porte le SERVEUR (backend + client
# web) et le CLIENT LG webOS servi sous /tv. Chacune est livrée par son propre
# workflow, et chacun ne reconstruit que la sienne :
#
#   • server.yml construit le serveur depuis les sources et REPREND le client
#     LG de l'image en service — il remplace l'étape « tv-client-build » par
#     cette image (contexte nommé) ;
#   • webos.yml construit le client LG et le pose sur l'image déjà livrée du
#     serveur — il remplace l'étape « server » par cette image, et l'étape
#     « tv-client » par le client qu'il vient de construire.
#
# Sans contexte nommé (docker compose build, docker build .), tout se
# construit depuis les sources, comme avant. Voir
# .github/workflows/server-image.yml.
#
# UNE IMAGE LÉGÈRE. L'image finale ne garde que ce qui tourne : Node, le
# serveur compilé, ses SEULES dépendances de production (élaguées), les deux
# clients et les outils média. Elle recopiait le `node_modules` complet du
# monorepo — dépendances de développement du web et du téléviseur comprises :
# 307 Mo compressés sur 479 (relevé du registre, v1.23.0).
ARG NODE_IMAGE=node:24-alpine

# ── Construction : l'espace de travail utile, dépendances de dev comprises ───
FROM ${NODE_IMAGE} AS base
WORKDIR /app

# pnpm à la version de `packageManager` (package.json), jamais « latest » : le
# même build ne doit pas changer d'outil d'un jour à l'autre.
COPY package.json ./
RUN corepack enable && corepack install

# `.npmrc` porte `node-linker=hoisted`, et il n'est pas facultatif : sans lui,
# pnpm installe en arborescence isolée et un paquet n'est visible que du
# `package.json` qui le déclare. Le client téléviseur compile les sources
# d'apps/web (React Query, framer-motion, hls.js…) sans les redéclarer — en
# isolé, leur résolution échoue et le build meurt sur `@tanstack/react-query`.
COPY pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/backend/package.json apps/backend/package.json
# Client LG webOS : une variante de build d'apps/web, servie par ce serveur
# sous /tv. Sans elle dans l'image, `existsSync(client/dist)` répond faux et
# /tv retombe silencieusement sur l'index.html du client web — un téléviseur y
# chargerait l'application de bureau.
COPY apps/tv-webos/package.json apps/tv-webos/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/plugins-api/package.json packages/plugins-api/package.json
COPY packages/theme/package.json packages/theme/package.json
# tv-core : le socle partagé des trois téléviseurs. Oublié ici, pnpm ne voit
# pas le paquet de l'espace de travail et ne lui crée pas son lien vers
# `@tentacle-tv/shared` ; la source arrive ensuite par le COPY global, et
# rollup meurt sur un import qu'il ne peut plus résoudre.
COPY packages/tv-core/package.json packages/tv-core/package.json
# offline-core : le cœur du hors ligne, compilé DEPUIS les sources par le
# client web (téléchargements, catalogue local). Même piège que tv-core
# ci-dessus — sans son `package.json` ici, pnpm ignore le paquet, ne lui pose
# pas son lien vers `@tentacle-tv/shared`, et tsc meurt sur chacun de ses
# imports une fois les sources arrivées par le COPY global.
COPY packages/offline-core/package.json packages/offline-core/package.json
COPY patches/ patches/
RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/web/ apps/web/
COPY apps/backend/ apps/backend/
COPY apps/tv-webos/ apps/tv-webos/
COPY tsconfig.base.json tsconfig.base.json
# Source unique des versions (BACKEND_VERSION + versions affichées par le web)
COPY versions.json versions.json
# Manifeste de compatibilité Jellyfin : le verdict connu hors ligne, que le
# serveur remplace par une révision plus récente lue sur GitHub.
COPY compat/jellyfin.json compat/jellyfin.json

WORKDIR /app/apps/web
RUN pnpm build

# La clé Klipy (GIFs du chat WT) est GRAVÉE dans le code compilé avant tsc
# (secret GitHub KLIPY_API_KEY → build-arg) : elle ne passe ni par l'ENV de
# l'image finale ni par docker-compose, et n'est pas modifiable par
# l'opérateur. Absente = GIFs proprement désactivés.
WORKDIR /app/apps/backend
ARG KLIPY_API_KEY=""
RUN KLIPY_API_KEY="$KLIPY_API_KEY" node scripts/bake-klipy-key.mjs
# Le client Prisma, le serveur compilé sans ses cartes de sources, et le
# schéma complet en SQL qu'une base vierge reçoit au premier démarrage
# (services/schemaInit) : la CLI Prisma ne part plus dans l'image.
RUN pnpm exec prisma generate \
  && pnpm build \
  && pnpm db:schema-sql \
  && find dist -name '*.map' -delete
# shared-deps.js : les dépendances communes des plugins (bac à sable)
RUN node scripts/build-shared-deps.js

# ── Le client LG webOS, construit depuis les sources ────────────────────────
# Il compile les sources d'apps/web avec sa propre table de substitutions ;
# `config/postcss/gardeCompat.ts` fait échouer le build si une primitive
# postérieure à Chrome 53 survit dans la feuille produite.
#
# La CI ne construit JAMAIS cette étape : server.yml la remplace par l'image en
# service (le client que lisent déjà les téléviseurs), webos.yml remplace
# l'étape suivante par le client qu'il a construit lui-même. Elle ne sert
# qu'aux builds locaux.
FROM base AS tv-client-build
WORKDIR /app/apps/tv-webos
RUN pnpm build

# Le client seul, à la racine : la forme exacte d'un contexte nommé
# `tv-client`, qui peut donc la remplacer telle quelle.
FROM scratch AS tv-client
COPY --from=tv-client-build /app/apps/tv-webos/client/dist /

# ── Les dépendances de production du serveur, seules, élaguées ──────────────
# Le serveur ne dépend d'aucun paquet de l'espace de travail : son
# `package.json` suffit. `pnpm deploy` en tire ses dépendances de production
# aux versions exactes du verrou — un `install --filter` en mode « hoisted »
# ramenait le verrou ENTIER (700 paquets, react-native et expo compris). Sans
# les pairs facultatifs de @prisma/client (la CLI prisma, typescript) ; et les
# patchs, qui ne visent que le mobile et la TV, sont tolérés sans emploi.
# Le client Prisma vient de l'étape de construction, déjà généré ; l'élagage
# (docker/prune-node-modules.sh) ne garde que ce que Node charge. Les modules
# serveur des plugins (Vigie) n'importent que des modules intégrés de Node :
# rien ne leur manque.
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json ./
RUN corepack enable && corepack install
COPY pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY patches/ patches/
RUN pnpm --filter @tentacle-tv/backend deploy --prod --legacy --ignore-scripts \
      --config.allow-unused-patches=true --config.auto-install-peers=false /deploy
COPY --from=base /app/node_modules/.prisma/client /deploy/node_modules/.prisma/client
COPY apps/backend/docker/prune-node-modules.sh /tmp/prune-node-modules.sh
RUN sh /tmp/prune-node-modules.sh /deploy/node_modules

# ── Le serveur : backend + client web, SANS le client LG ────────────────────
FROM ${NODE_IMAGE} AS server

# NODE_ENV n'était posé NULLE PART — cookies sans Secure, outil de diagnostic
# joignable, cache de shared-deps.js coupé. Le port et l'interface suivent
# l'EXPOSE : sans PORT, le serveur écoutait sur 3001 derrière un EXPOSE 3000.
# XDG_CACHE_HOME : yt-dlp écrit son cache là où l'utilisateur du serveur le peut.
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    TENTACLE_DEPLOYMENT=docker \
    XDG_CACHE_HOME=/tmp/.cache

# chromaprint : `fpcalc`, l'empreinte audio de l'analyse inter-épisodes
# (services/audioFingerprintTool.ts) — binaire LGPL invoqué, jamais lié.
# ffmpeg : décode l'extrait audio de l'analyse de fin de média
# (services/tailAnalysis/tailAudio.ts). python3 : fait tourner le zipapp de
# yt-dlp. Plus de deno : yt-dlp résout les défis JavaScript de YouTube avec le
# Node du serveur (≥ 22, services/trailers/ytExtract.ts). su-exec : rendre la
# main à l'utilisateur du serveur après la préparation du volume. tini : un
# vrai PID 1, qui transmet les signaux et récolte les processus orphelins.
RUN apk add --no-cache chromaprint ffmpeg python3 su-exec tini

# yt-dlp : résolution des bandes-annonces YouTube → flux HLS jouable (Apple TV
# n'a pas de WebView). Le zipapp OFFICIEL, épinglé et vérifié : le paquet
# Alpine traînait des mois derrière YouTube (2026.03.17 dans Alpine 3.23, sans
# HLS). Le backend le remplace à l'exécution par la dernière version officielle
# (services/ytDlp.ts) ; celui-ci reste le repli. Monter de version :
# docs/RELEASE.md, « Serveur (image Docker) ».
ARG YTDLP_VERSION=2026.08.19
ARG YTDLP_SHA256=1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6
RUN wget -q -O /usr/local/bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" \
  && echo "${YTDLP_SHA256}  /usr/local/bin/yt-dlp" | sha256sum -c - \
  && chmod +x /usr/local/bin/yt-dlp \
  && [ "$(yt-dlp --version)" = "${YTDLP_VERSION}" ]

WORKDIR /app
COPY --from=prod-deps /deploy/node_modules ./node_modules
COPY --from=base /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=base /app/apps/backend/dist ./apps/backend/dist
COPY --from=base /app/apps/backend/prisma/core-init.sql /app/apps/backend/prisma/schema-full.sql ./apps/backend/prisma/
# Les dépendances partagées des plugins : l'entrypoint les recopie à chaque
# démarrage dans le volume, pour qu'une mise à jour de l'image les apporte.
COPY --from=base /app/apps/backend/data/shared-deps /app/shared-deps-seed
COPY --from=base /app/apps/web/dist ./apps/web/dist
# versions.json à /app : lu par BACKEND_VERSION (dist/services → ../../../../)
COPY --from=base /app/versions.json ./versions.json
# compat/jellyfin.json à /app : cherché en remontant depuis dist/services/jellyfinCompat
COPY --from=base /app/compat/jellyfin.json ./compat/jellyfin.json
COPY --chmod=0755 apps/backend/docker-entrypoint.sh ./apps/backend/docker-entrypoint.sh
RUN mkdir -p /app/apps/backend/data && chown node:node /app/apps/backend/data

WORKDIR /app/apps/backend
EXPOSE 3000
# Sans curl : le fetch de Node suffit. /api/health répond aussi en mode
# installation. Sonde rapprochée au démarrage (`--start-interval`) : un compose
# qui attend ce serveur « sain » n'attend pas trente secondes de plus.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --start-interval=3s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
ENTRYPOINT ["/sbin/tini", "--", "/app/apps/backend/docker-entrypoint.sh"]
CMD ["serve"]

# ── L'image livrée : le serveur, puis le client LG par-dessus ───────────────
# DERNIÈRE étape, donc la cible par défaut. Chemins absolus : le WORKDIR hérité
# est celui du backend.
FROM server AS production

# Quand « server » est une image déjà publiée (webos.yml), elle porte le client
# d'avant : on l'efface avant de poser le nouveau. Sans cela ses fichiers
# resteraient à côté — et un téléviseur resté allumé continuerait de charger
# d'anciens morceaux au lieu de se recharger (lib/staleBuildReload.ts).
RUN rm -rf /app/apps/tv-webos/client/dist

# Le client téléviseur, à l'emplacement exact que `staticClients.ts` résout
# depuis `apps/backend/dist/static` : ../../../tv-webos/client/dist
COPY --from=tv-client / /app/apps/tv-webos/client/dist

# Sans `index.html`, `staticClients.ts` retomberait sur `client/public` — absent
# de l'image — et /tv servirait en silence l'index du client WEB : un
# téléviseur chargerait l'application de bureau. Mieux vaut ne pas livrer.
RUN test -f /app/apps/tv-webos/client/dist/index.html
