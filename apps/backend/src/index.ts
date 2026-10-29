import Fastify from "fastify";
import cors from "@fastify/cors";
import { parseCorsOrigins, tentacleCorsDelegator } from "./services/tentacleCors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";

import { registerStaticClients } from "./static/staticClients";
import { readOverrideFile, resolveWebUi } from "./static/webUi";
import { LOG_REDACT_PATHS, redactUrl } from "./services/logRedaction";
import { getRealClientIp } from "./services/networkUtils";
import { challengeRoutes } from "./remoteAccess/challengeRoute";
import { isTrustedProxy } from "./services/trustedProxies";
import { getDatabaseFilePath, initPrisma, retryDatabaseOpen } from "./services/db";
import { legacySourceState } from "./services/database/legacySource";
import { migrateBeforeBoot } from "./dbMigration/bootMigration";
import { consumeRemigrationRequest, startPostMigrationTasks } from "./dbMigration/postMigration";
import { holdOrphanedInstallation, orphanedLegacyInstallation } from "./dbMigration/orphanedSource";
import { startMigrationMaintenance } from "./dbMigration/maintenance/startMigrationMaintenance";
import { databaseStorage } from "./services/database/storageMount";
import { applyPairingEpoch } from "./services/pairingEpoch";
import { retireAudioAnalysis } from "./services/audioAnalysisRetirement";
import { detectAppState, getAppState } from "./services/configStore";
import { ensureInstallId } from "./services/jellyfinIdentity";

import { setupWizardRoutes } from "./setup/setupWizardRoutes";
import { bootSetup } from "./setup/setupRuntime";
import { registerApplicationRoutes } from "./routes/applicationRoutes";
import { healthRoutes } from "./routes/health";
import { themeRoutes } from "./routes/theme";
import { stopRecoJobs } from "./services/reco/jobs";
import { stopSearchJobs } from "./services/search/jobs";
import { stopWatchTime } from "./services/watchTime/collector";
import { savePendingPreviewMemory } from "./services/trailers/preview/previewMemoryStore";
import { startBackgroundServices } from "./services/backgroundServices";
import { loadPluginBackends } from "./services/pluginBackendLoader";
import { clientFetchBroker, configureClientFetch, registerIsolatedRuntime, stopIsolatedRuntime } from "./plugins/runtime";
import { isDeviceOnline, onDevicePresenceChange, sendToDevices } from "./services/wsManager";
import { configureIsolatedRuntime } from "./plugins/runtime/hostServices";
import { musicLibrary, findByMbid, matchTracks, libraryTrackFor, setFavorite, playlistInsert, playlistSourceRemoved, playlistEntries, playlistEditable, usageOf, notifyPath, refreshPath } from "./music/host/jellyfinMusicHost";
import { sendMusicEvent, broadcastMusicEvent } from "./music/events/musicSend";
import { onAudioItems } from "./music/events/audioItemsFeed";
import type { MusicEvent } from "./music/contract/musicEvents";
import { serverShutdown } from "./services/lifecycle/serverShutdown";
import { announceProgress, announceReady, beginServerLifecycle, failStartup, startupFailureOf } from "./serverHost/serverLifecycle";
import { registerWatchTogetherGateway } from "./services/watchTogether/gateway";
import { watchPlaybackPolicyWrites } from "./services/playbackRights";
import { registerAccountAccessWatch } from "./services/accountAccess/accessWatch";
import { watchRightsLive } from "./services/rightsLive/rightsLive";
import { registerBodyParsers } from "./services/bodyParsers";
import { registerErrorHandler } from "./services/errorHandler";
import { routedPath } from "./utils/routedPath";
import { rateLimitKey, rateLimitMax } from "./services/rateLimitPolicy";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  // AVANT tout : l'arrêt unique (signaux, hôte Windows) et le verrou d'instance —
  // un second serveur sur ces données sort ici, sans avoir rien touché.
  if (!(await beginServerLifecycle())) return;

  // Une MariaDB d'avant 1.25 attend sa migration : un serveur de MAINTENANCE à
  // part la mène (écran d'attente ; ni Prisma, ni route du cœur, ni extension)
  // et se ferme à la bascule. Le démarrage normal reprend ici, sur la base née.
  consumeRemigrationRequest();
  if (legacySourceState() === "pending") await migrateBeforeBoot({ startMaintenance: () => startMigrationMaintenance(PORT, HOST) });
  // Une installation qui AVAIT une MariaDB, plus configurée : jamais une base vide à sa place.
  else if (orphanedLegacyInstallation()) await holdOrphanedInstallation(() => startMigrationMaintenance(PORT, HOST));

  announceProgress("server");
  const app = Fastify({
    logger: {
      // Ni jeton, ni mot de passe, ni clé — où qu'un appel de journal les mette.
      redact: { paths: LOG_REDACT_PATHS, censor: "[redacted]" },
      serializers: {
        req(request) {
          return {
            method: request.method,
            // Les segments HLS portent le jeton de session dans l'URL.
            url: redactUrl(request.url),
            host: request.headers?.host,
            remoteAddress: getRealClientIp(request),
            remotePort: request.raw?.socket?.remotePort,
          };
        },
      },
    },
    // Allow large bodies for proxied requests (images, etc.)
    bodyLimit: 50 * 1024 * 1024,
    // `X-Forwarded-*` cru des seuls mandataires voisins (cf. trustedProxies.ts).
    trustProxy: (address: string) => isTrustedProxy(address),
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  });

  // yt-embed.html doit être framable depuis l'origine tauri:// (macOS webview)
  // et envoyer un Referer à YouTube → on neutralise X-Frame-Options et on impose
  // Referrer-Policy: strict-origin-when-cross-origin uniquement pour ce chemin.
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.split("?")[0] === "/yt-embed.html") {
      reply.raw.removeHeader("X-Frame-Options");
      reply.header("referrer-policy", "strict-origin-when-cross-origin");
      reply.header("content-security-policy", "frame-ancestors *;");
    }
    return payload;
  });

  // Cookie support (httpOnly auth cookies for web)
  await app.register(cookie);

  // CORS de Tentacle : permissif sans `CORS_ORIGINS` ; avec, la liste plus les
  // applications de bureau (Electron `tentacle://app`, ancienne coquille Tauri),
  // le lien public et l'adresse locale réglés, et la page servie par Tentacle
  // lui-même — décidé requête par requête (`services/tentacleCors.ts`).
  await app.register(cors, { delegator: tentacleCorsDelegator(parseCorsOrigins(process.env.CORS_ORIGINS)) });

  await app.register(compress, { threshold: 1024 });
  // Images et API ne partagent plus le même compteur — cf. rateLimitPolicy.ts.
  await app.register(rateLimit, {
    max: (request) => rateLimitMax(request),
    keyGenerator: (request) => rateLimitKey(request),
    timeWindow: "1 minute",
  });
  await app.register(websocket);

  // Gestionnaire d'erreurs global : rien de l'intérieur sur une 5xx (services/errorHandler.ts).
  registerErrorHandler(app);

  // Parsers de corps custom (JSON tolérant, binaire brut, image/*) — voir services/bodyParsers.ts
  registerBodyParsers(app);

  // ── Setup routes (always available) ──
  await app.register(setupWizardRoutes, { prefix: "/api/setup" });
  await app.register(healthRoutes, { prefix: "/api" });
  // Le défi du test d'ouverture, lu depuis Internet par le service de test.
  await app.register(challengeRoutes);

  // ── Theme routes (always available — clients need them pre-setup to boot) ──
  await app.register(themeRoutes, { prefix: "/api/theme" });

  // ── Setup guard: block most API routes until setup is complete ──
  let lastStateCheck = 0;
  app.addHook("onRequest", async (request, reply) => {
    // Le chemin décodé, celui que le routeur suit : `/%61pi/…` ne saute pas la garde.
    const url = routedPath(request.url);
    // Always allow: setup, health, theme (read-only public), websocket, static files
    if (url.startsWith("/api/setup") || url.startsWith("/api/health") || url.startsWith("/api/ws") || url.startsWith("/api/theme") || !url.startsWith("/api/")) {
      return;
    }
    let state = getAppState();
    if (state !== "running") {
      // État relu au plus toutes les 10 s ; une base qui ne s'ouvrait pas est
      // réessayée, jamais à côté d'une MariaDB qui attend sa migration
      // (`retryDatabaseOpen`).
      const now = Date.now();
      if (now - lastStateCheck > 10_000) {
        lastStateCheck = now;
        try {
          const ok = await retryDatabaseOpen(now);
          if (ok) {
            state = await detectAppState();
            if (state === "running") {
              console.log("[Guard] Auto-recovery succeeded — state is now running");
              startBackgroundServices();
            }
          }
        } catch (err) {
          console.warn("[Guard] Auto-recovery failed:", err);
        }
      }
      if (state !== "running") {
        return reply.status(503).send({
          message: state === "database_unavailable" ? "Database unavailable" : "Setup required",
          setupState: state,
        });
      }
    }
  });

  // ── Application routes (active only after setup) ──
  // Jusqu'au proxy de Jellyfin, en dernier : l'ordre est celui de
  // `routes/applicationRoutes.ts`.
  await registerApplicationRoutes(app);

  await registerStaticClients(app);
  const webUi = resolveWebUi(process.env, readOverrideFile());
  if (!webUi.enabled) {
    console.log(`[Web] Interface web coupée (${webUi.source === "cli" ? "tentacle web off" : "TENTACLE_WEB_UI=off"}) : l'API, /tv et les applications restent servies, l'assistant aussi tant que l'installation n'est pas finie. Rallumer : tentacle web on`);
  }

  // ── La base : un fichier SQLite du dossier de données, rien à configurer ──
  // Une MariaDB d'avant 1.25 attend sa migration : on ne crée pas de base vide
  // à côté (elle passerait pour la nôtre, et la migration n'aurait plus lieu).
  // Relevé AVANT toute ouverture par Prisma (il lit tentacle.db par node:sqlite).
  announceProgress("database");
  const legacy = legacySourceState();
  if (legacy === "pending") {
    console.warn("[db] Une base MariaDB est configurée et n'a pas encore été migrée vers SQLite : ses données attendent leur migration. MariaDB n'est pas modifiée.");
  } else {
    if (legacy === "never_migrated") {
      console.warn("[db] Une base MariaDB est configurée mais n'a jamais été migrée : data/tentacle.db a été installée sans elle. Rien n'est fait automatiquement.");
    }
    const connected = await initPrisma();
    if (connected) {
      console.log(`[db] SQLite ouverte : ${getDatabaseFilePath()}`);
      if (databaseStorage(getDatabaseFilePath()) === "network") {
        console.warn("[db] ⚠️ La base est sur un partage réseau (NFS, SMB…) : SQLite peut s'y corrompre. Placez le dossier de données sur un disque local.");
      }
      await detectAppState();
      // Identifiant d'installation résolu au démarrage : `mediaBrowserAuthHeader`
      // le lit de façon synchrone. Échec non bloquant — il sera réessayé au
      // premier chemin async qui en a besoin (login, setup, provisionnement).
      await ensureInstallId().catch((err) => {
        console.warn("[Identity] install id unavailable at boot:", err?.message ?? err);
      });
      // Rejumelage général des téléviseurs quand `versions.json` le demande.
      // Après `detectAppState`, qui a chargé `server_config` en mémoire.
      await applyPairingEpoch();
      // L'analyse audio retirée : ses réglages d'avant effacés, une fois.
      await retireAudioAnalysis();
    } else {
      console.warn("[db] Base indisponible : seuls l'assistant et /api/health répondent");
    }
  }

  const state = getAppState();
  console.log(`[App] State: ${state}`);
  // Installation ouverte : un code neuf dans les journaux, et le Jellyfin
  // voisin (pile complète) verrouillé. Le port annoncé est celui de l'hôte.
  bootSetup(process.env.TENTACLE_HOST_PORT || PORT);

  // Watch Together : présence (grâce de déconnexion, délivrance des invites).
  // Inconditionnel — le WS /api/ws est exempté du guard de setup.
  registerWatchTogetherGateway();
  // Droits de lecture : relus aussitôt qu'une politique est écrite par Tentacle.
  watchPlaybackPolicyWrites();
  registerAccountAccessWatch();
  // Les droits changés s'annoncent aux appareils du compte (`rights:changed`).
  watchRightsLive();

  // Start background workers only when fully configured
  if (state === "running") {
    // Une base née d'une migration : le cache TMDB copié en fond, l'ancienne base contrôlée.
    startPostMigrationTasks();
    startBackgroundServices();
    announceProgress("extensions");
    // Load plugin backend modules (server-side routes declared by plugins)
    await loadPluginBackends(app);
    // Les extensions ISOLÉES : leur processus, et le relais de leurs routes (plugins/runtime/).
    // Ce que le runtime emprunte à la musique du cœur (lot A3) : Jellyfin, événements, éléments audio vus.
    configureIsolatedRuntime({
      jellyfin: { musicLibrary, findByMbid, matchTracks, setFavorite, playlistInsert, playlistSourceRemoved, playlistEntries, playlistEditable, usageOf, notifyPath, refreshPath },
      sendMusicEvent: (ids, event) => sendMusicEvent(ids, event as MusicEvent),
      broadcastMusicEvent: (event) => broadcastMusicEvent(event as MusicEvent),
      onAudioItems,
      libraryTrack: libraryTrackFor,
    });
    // Les requêtes déléguées : poussées sur la socket de l'appareil visé ; ses poignées tombent avec lui.
    configureClientFetch({ send: (key, job) => (isDeviceOnline(key) ? (sendToDevices([key], job), true) : false), online: isDeviceOnline });
    onDevicePresenceChange((_userId, key, online) => {
      if (!online) clientFetchBroker()?.forgetDevice(key);
    });
    await registerIsolatedRuntime(app);
  }

  // L'arrêt propre, borné étape par étape (`lifecycle/serverShutdown.ts`) : les
  // tâches de fond D'ABORD — le collecteur de temps rend son bail, un redémarrage
  // reprend la mesure aussitôt —, puis le HTTP (un flux relayé ne le retient
  // plus), puis la base. Le redémarrage d'une extension passe par le même.
  serverShutdown.register({
    stopBackgroundWork: async () => {
      stopRecoJobs();
      stopSearchJobs();
      // Les décisions d'aperçu des dernières secondes : écrites avant de partir.
      savePendingPreviewMemory();
      await stopWatchTime();
      // Chaque invité isolé reçoit `shutdown` ; ses ouvriers partent avec lui.
      await stopIsolatedRuntime();
    },
    closeHttp: () => app.close(),
  });

  await app.listen({ port: PORT, host: HOST });
  console.log(`Tentacle running on http://localhost:${PORT} (state: ${state})`);
  announceReady(PORT);
}

// Port pris ou autre échec : l'hôte Windows le sait, la base est fermée proprement.
main().catch((err) => failStartup(startupFailureOf(err), err instanceof Error ? err.message : String(err)));
