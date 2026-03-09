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

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code (only web, backend, and shared packages)
COPY packages/ packages/
COPY apps/web/ apps/web/
COPY apps/backend/ apps/backend/
COPY tsconfig.base.json tsconfig.base.json

# Build frontend
WORKDIR /app/apps/web
RUN pnpm build

# Build backend
WORKDIR /app/apps/backend
RUN pnpm build && npx prisma generate

# Build shared-deps.js for plugin sandbox
RUN node scripts/build-shared-deps.js

# Production image
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

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

# Copy entrypoint script
COPY apps/backend/docker-entrypoint.sh ./apps/backend/docker-entrypoint.sh
RUN chmod +x ./apps/backend/docker-entrypoint.sh

EXPOSE 3000

WORKDIR /app/apps/backend

CMD ["sh", "docker-entrypoint.sh"]
