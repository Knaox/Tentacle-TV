FROM node:20-alpine AS base

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config and all package.json files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/plugins-api/package.json packages/plugins-api/package.json
COPY packages/theme/package.json packages/theme/package.json
COPY patches/ patches/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code (only web, backend, and shared packages)
COPY packages/ packages/
COPY apps/web/ apps/web/
COPY apps/backend/ apps/backend/
COPY tsconfig.base.json tsconfig.base.json
# Source unique des versions (BACKEND_VERSION + versions affichées par le web)
COPY versions.json versions.json

# Build frontend
WORKDIR /app/apps/web
RUN pnpm build

# Build backend — la clé Klipy (GIFs du chat WT) est GRAVÉE dans le code
# compilé avant tsc (secret GitHub KLIPY_API_KEY → build-arg) : elle ne passe
# ni par l'ENV de l'image finale ni par docker-compose, et n'est pas
# modifiable par l'opérateur. Absente = GIFs proprement désactivés.
WORKDIR /app/apps/backend
ARG KLIPY_API_KEY=""
RUN KLIPY_API_KEY="$KLIPY_API_KEY" node scripts/bake-klipy-key.mjs
RUN npx prisma generate && pnpm build

# Build shared-deps.js for plugin sandbox
RUN node scripts/build-shared-deps.js

# Production image
FROM node:20-alpine AS production

# NODE_ENV n'était posé NULLE PART — ni ici, ni dans docker-compose, ni dans
# l'entrypoint. Trois conséquences, toutes silencieuses :
#
#  - six `setCookie` posaient `secure: NODE_ENV === "production"`, donc `false` :
#    le cookie de session partait sans le drapeau Secure. (Corrigé à la source
#    par `secure: "auto"`, qui suit le protocole réel — ceci n'en est plus la
#    condition, tant mieux.)
#  - `/api/push/test` se voulait « introuvable en prod, même admin » : son garde
#    est `if (NODE_ENV === "production") return 404`, qui ne se déclenchait
#    jamais. L'outil de diagnostic était donc joignable en production.
#  - `shared-deps.js` était servi en `no-cache` au lieu d'un cache d'un jour.
#
# Posé dans l'étage de PRODUCTION uniquement : dans l'étage de build, il ferait
# sauter les devDependencies dont `tsc` et `vite` ont besoin.
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# yt-dlp : résolution des bandes-annonces YouTube → flux MP4 jouable (Apple TV
# n'a pas de WebView). Paquet du dépôt community Alpine (tire python3 en dépendance).
RUN apk add --no-cache yt-dlp

WORKDIR /app

# Copy built artifacts
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/backend/dist ./apps/backend/dist
COPY --from=base /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=base /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=base /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=base /app/apps/backend/data/shared-deps ./apps/backend/data/shared-deps
# Seed copy for shared-deps — entrypoint refreshes them on every start
# so that image updates bring new shared-deps even when volume already exists
COPY --from=base /app/apps/backend/data/shared-deps /app/shared-deps-seed
COPY --from=base /app/apps/web/dist ./apps/web/dist
# versions.json à /app : lu par BACKEND_VERSION (dist/services → ../../../../)
COPY --from=base /app/versions.json ./versions.json

# Copy entrypoint script
COPY apps/backend/docker-entrypoint.sh ./apps/backend/docker-entrypoint.sh
RUN chmod +x ./apps/backend/docker-entrypoint.sh

EXPOSE 3000

WORKDIR /app/apps/backend

CMD ["sh", "docker-entrypoint.sh"]
