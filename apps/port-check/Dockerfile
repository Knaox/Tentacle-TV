# syntax=docker/dockerfile:1
# Le service de test d'ouverture des serveurs Tentacle (check.tentacletv.app).
# Il n'est construit ni publié par aucun workflow : on le déploie à la main.
#
#   docker build -f apps/port-check/Dockerfile -t tentacle-port-check .
#   docker run -p 8080:8080 tentacle-port-check
#
# Contexte : la racine du dépôt, filtrée par Dockerfile.dockerignore (liste
# blanche). L'image finale ne garde qu'un fichier : le service empaqueté par
# esbuild (Fastify et Zod compris), sur Node distroless, sans shell ni root.
# Images de base ÉPINGLÉES par empreinte (index multi-arch), tag en commentaire —
# voir le Dockerfile racine pour la marche à suivre.
# node:24.22.1-alpine3.24 (relevé le 2026-10-22)
ARG NODE_IMAGE=node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53

FROM ${NODE_IMAGE} AS build
WORKDIR /repo
COPY package.json ./
RUN corepack enable && corepack install
COPY pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY patches/ patches/
COPY apps/port-check/ apps/port-check/
# `deploy` tire du verrou les seules dépendances du service (dev comprises :
# esbuild empaquette), sans le reste de l'espace de travail.
RUN pnpm --filter @tentacle-tv/port-check deploy --legacy --ignore-scripts \
      --config.allow-unused-patches=true --config.auto-install-peers=false /deploy
WORKDIR /deploy
RUN node node_modules/esbuild/bin/esbuild src/index.ts --bundle --platform=node --target=node24 \
      --format=cjs --outfile=dist/server.cjs --legal-comments=none

# gcr.io/distroless/nodejs24-debian12:nonroot (relevé le 2026-10-22)
FROM gcr.io/distroless/nodejs24-debian12:nonroot@sha256:14d42e2511532589a7c7e01a753667a74fcc96266e137e8125006b87b0c32d0a
WORKDIR /app
COPY --from=build /deploy/dist/server.cjs /app/server.cjs
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER nonroot
CMD ["/app/server.cjs"]
