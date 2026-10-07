import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import websocket from "@fastify/websocket";

import { registerStaticClients } from "./static/staticClients";
import { LOG_REDACT_PATHS, redactUrl } from "./services/logRedaction";
import { getRealClientIp } from "./services/networkUtils";
import { challengeRoutes } from "./remoteAccess/challengeRoute";
import { isTrustedProxy } from "./services/trustedProxies";
import { initPrisma, hasDatabaseUrl, getDatabaseUrl, getDatabaseUrlSource, reconnectPrisma } from "./services/db";
import { ensureDatabaseSchema } from "./services/schemaInit/ensureSchema";
import { applyPairingEpoch } from "./services/pairingEpoch";
import { applyAudioAnalysisDefault } from "./services/audioAnalysisDefault";
import { applyExposureDefault } from "./remoteAccess/exposureDefault";
import { detectAppState, getAppState } from "./services/configStore";
import { ensureInstallId } from "./services/jellyfinIdentity";

import { setupWizardRoutes } from "./setup/setupWizardRoutes";
import { bootSetup } from "./setup/setupRuntime";
import { authRoutes } from "./routes/auth";
import { inviteRoutes } from "./routes/invites";
import { healthRoutes } from "./routes/health";
import { configRoutes } from "./routes/config";
import { demoRoutes } from "./routes/demo";
import { preferenceRoutes } from "./routes/preferences";
import { updateRoutes } from "./routes/update";
import { ticketRoutes } from "./routes/tickets";
import { notificationRoutes } from "./routes/notifications";
import { pushRoutes } from "./routes/push";
import { jellyfinProxyRoutes } from "./routes/jellyfinProxy";
import { jellyfinTrickplayRoutes } from "./routes/jellyfinTrickplay";
import { playbackSegmentRoutes } from "./routes/playbackSegments";
import { adminRoutes } from "./routes/admin";
import { adminDownloadRoutes } from "./routes/adminDownloads";
import { adminMetadataRoutes } from "./routes/adminMetadata";
import { adminSegmentRoutes } from "./routes/adminSegments";
import { downloadRoutes } from "./routes/downloads";
import { pluginRoutes } from "./routes/plugins";
import { pairRoutes } from "./routes/pair";
import { familyRoutes } from "./routes/family/familyRoutes";
import { adminFamilyRoutes, familyTvRoutes } from "./routes/family/familyTvRoutes";
import { shareRoutes } from "./routes/share";
import { tmdbRoutes } from "./routes/tmdb";
import { heroArtworkRoutes } from "./routes/heroArtwork";
import { trailerRoutes } from "./routes/trailers";
import { trailerMediaRoutes } from "./routes/trailerMedia";
import { trailerReadinessRoutes } from "./routes/trailerReadiness";
import { gifRoutes } from "./routes/gifs";
import { themeRoutes } from "./routes/theme";
import { wsRoutes } from "./routes/ws";
import { watchTogetherRoutes } from "./routes/watchTogether";
import { watchTogetherInviteRoutes } from "./routes/watchTogetherInvites";
import { watchTogetherUsersRoutes } from "./routes/watchTogetherUsers";
import { watchTogetherAffinityRoutes } from "./routes/watchTogetherAffinity";
import { leaderboardRoutes } from "./routes/leaderboard";
import { viewingStatsRoutes } from "./routes/viewingStats";
import { ratingRoutes } from "./routes/ratings";
import { likeRoutes } from "./routes/likes";
import { swipeRoutes } from "./routes/swipe";
import { watchlistRoutes } from "./routes/watchlist";
import { recoRoutes } from "./routes/reco";
import { recoPeopleRoutes } from "./routes/recoPeople";
import { searchRoutes } from "./routes/search";
import { sagaRoutes } from "./routes/sagas";
import { recoPageRoutes } from "./routes/recoPage";
import { recoRowRoutes } from "./routes/recoRows";
import { externalAccountRoutes } from "./routes/externalAccounts";
import { stopRecoJobs } from "./services/reco/jobs";
import { stopSearchJobs } from "./services/search/jobs";
import { stopWatchTime } from "./services/watchTime/collector";
import { startBackgroundServices } from "./services/backgroundServices";
import { loadPluginBackends } from "./services/pluginBackendLoader";
import { setRestartShutdown } from "./services/pluginRestart";
import { registerWatchTogetherGateway } from "./services/watchTogether/gateway";
import { registerBodyParsers } from "./services/bodyParsers";
import { rateLimitKey, rateLimitMax } from "./services/rateLimitPolicy";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
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

  // CORS: restrictive in production, permissive in dev
  const corsOrigins = process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  // Origines des webviews des apps de bureau — toujours autorisées car émises
  // uniquement par l'app native, jamais par un navigateur tiers.
  //
  //  - Tauri (macOS, Linux)  : tauri://localhost, http(s)://tauri.localhost
  //  - Electron (Windows)    : tentacle://app — schéma privilégié déclaré par
  //    la coquille (`apps/desktop-electron/src/main/appProtocol.ts`).
  //
  // ⚠️ L'origine Electron manquait. Dès que `CORS_ORIGINS` est défini — donc en
  // production —, la coquille se faisait refuser CHAQUE appel au préambule
  // (« Response to preflight request doesn't pass access control check »), y
  // compris la connexion. Elle ne s'en apercevait pas en développement tant que
  // la variable restait vide, la politique étant alors permissive.
  const APP_ORIGINS = [
    "tauri://localhost",
    "https://tauri.localhost",
    "http://tauri.localhost",
    "tentacle://app",
  ];
  await app.register(cors, {
    origin: corsOrigins?.length
      ? (origin, cb) => {
          // Allow requests with no origin (mobile apps, curl, server-to-server)
          if (!origin) return cb(null, true);
          if (corsOrigins.includes(origin) || APP_ORIGINS.includes(origin)) return cb(null, true);
          cb(new Error("CORS origin not allowed"), false);
        }
      : true,
    credentials: true,
  });

  await app.register(compress, { threshold: 1024 });
  // Images et API ne partagent plus le même compteur — cf. rateLimitPolicy.ts.
  await app.register(rateLimit, {
    max: (request) => rateLimitMax(request),
    keyGenerator: (request) => rateLimitKey(request),
    timeWindow: "1 minute",
  });
  await app.register(websocket);

  // Global error handler: hide internals on 5xx, pass 4xx, format ZodErrors
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: "Validation error",
        errors: error.errors,
      });
    }

    const statusCode = (error as any).statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(error);
      return reply.status(statusCode).send({ message: "Internal server error" });
    }

    return reply.status(statusCode).send({
      message: (error as Error).message || "Error",
    });
  });

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
  let lastRecoveryAttempt = 0;
  // Le schéma (core-init.sql, et tout le schéma sur une base vierge) se pose une
  // fois par processus, dès que la base répond — au démarrage ou à la reprise.
  let schemaReady = false;
  app.addHook("onRequest", async (request, reply) => {
    const url = request.url;
    // Always allow: setup, health, theme (read-only public), websocket, static files
    if (url.startsWith("/api/setup") || url.startsWith("/api/health") || url.startsWith("/api/ws") || url.startsWith("/api/theme") || !url.startsWith("/api/")) {
      return;
    }
    let state = getAppState();
    if (state !== "running") {
      // Try auto-recovery (at most once per 10s to avoid hammering)
      const now = Date.now();
      if (now - lastRecoveryAttempt > 10_000 && hasDatabaseUrl()) {
        lastRecoveryAttempt = now;
        try {
          const ok = await reconnectPrisma();
          if (ok) {
            // Base injoignable au démarrage : son schéma n'a pas encore été vérifié.
            const url = getDatabaseUrl();
            if (!schemaReady && url) schemaReady = await ensureDatabaseSchema(url);
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
          message: "Setup required",
          setupState: state,
        });
      }
    }
  });

  // ── Application routes (active only after setup) ──
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(inviteRoutes, { prefix: "/api/invites" });
  await app.register(preferenceRoutes, { prefix: "/api/preferences" });
  await app.register(updateRoutes, { prefix: "/api/update" });
  await app.register(ticketRoutes, { prefix: "/api/tickets" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  await app.register(pushRoutes, { prefix: "/api/push" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(adminDownloadRoutes, { prefix: "/api/admin/downloads" });
  // Fichier séparé d'admin.ts : lui frôle déjà le plafond de 300 lignes.
  await app.register(adminMetadataRoutes, { prefix: "/api/admin" });
  await app.register(adminSegmentRoutes, { prefix: "/api/admin" });
  await app.register(downloadRoutes, { prefix: "/api/downloads" });
  await app.register(pluginRoutes, { prefix: "/api/plugins" });
  await app.register(pairRoutes, { prefix: "/api/pair" });
  // La Famille (docs/FAMILLE.md) : routes et appelants tirés du contrat.
  await app.register(familyRoutes, { prefix: "/api/family" });
  await app.register(familyTvRoutes, { prefix: "/api/family" });
  await app.register(adminFamilyRoutes, { prefix: "/api/admin" });
  await app.register(shareRoutes, { prefix: "/api/share" });
  await app.register(tmdbRoutes, { prefix: "/api/tmdb" });
  await app.register(heroArtworkRoutes, { prefix: "/api/hero" });
  await app.register(trailerRoutes, { prefix: "/api/trailers" });
  // Les flux relayés des bandes-annonces : jeton dans l'URL, AVPlayer n'envoie pas d'en-tête.
  await app.register(trailerMediaRoutes, { prefix: "/api/trailers" });
  // Le diagnostic des bandes-annonces, résumé pour tout compte connecté.
  await app.register(trailerReadinessRoutes, { prefix: "/api/trailers" });
  await app.register(gifRoutes, { prefix: "/api/gifs" });
  await app.register(wsRoutes, { prefix: "/api/ws" });
  await app.register(watchTogetherRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherInviteRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherUsersRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherAffinityRoutes, { prefix: "/api/watch-together" });
  await app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });
  await app.register(viewingStatsRoutes, { prefix: "/api/stats" });
  await app.register(ratingRoutes, { prefix: "/api/ratings" });
  await app.register(likeRoutes, { prefix: "/api/likes" });
  await app.register(swipeRoutes, { prefix: "/api/swipe" });
  await app.register(watchlistRoutes, { prefix: "/api/watchlist" });
  await app.register(recoRoutes, { prefix: "/api/reco" });
  await app.register(recoRowRoutes, { prefix: "/api/reco" });
  await app.register(recoPeopleRoutes, { prefix: "/api/reco" });
  await app.register(recoPageRoutes, { prefix: "/api/reco" });
  await app.register(searchRoutes, { prefix: "/api/search" });
  await app.register(sagaRoutes, { prefix: "/api/sagas" });
  await app.register(externalAccountRoutes, { prefix: "/api/external" });
  await app.register(configRoutes, { prefix: "/api" });
  await app.register(demoRoutes, { prefix: "/api" });
  // Segments de lecture : le résolveur unique (préfixe hors /api/jellyfin —
  // aucun rapport d'ordre avec le proxy générique).
  await app.register(playbackSegmentRoutes, { prefix: "/api/playback" });

  // ── Jellyfin trickplay tiles (specific route — must register BEFORE the wildcard proxy) ──
  await app.register(jellyfinTrickplayRoutes, { prefix: "/api/jellyfin" });

  // ── Jellyfin proxy (all Jellyfin API calls go through here) ──
  await app.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });

  await registerStaticClients(app);

  // ── Initialize database (with retry for Docker Compose / slow DB starts) ──
  const dbUrl = getDatabaseUrl();
  // L'environnement, c'est DATABASE_URL ou les variables DB_* des piles Docker.
  const dbSource = getDatabaseUrlSource() === "env" ? "env" : dbUrl ? "file (data/database.json)" : "none";
  console.log(`[DB] DATABASE_URL source: ${dbSource}`);
  if (dbUrl) {
    // Log masked URL for debugging
    const masked = dbUrl.replace(/:([^@]+)@/, ":***@");
    console.log(`[DB] URL: ${masked}`);
  }

  if (dbUrl) {
    let connected = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      connected = await initPrisma();
      if (connected) break;
      console.warn(`[DB] Connection attempt ${attempt}/5 failed — retrying in 2s`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (connected) {
      console.log("[DB] Connected successfully");
      schemaReady = await ensureDatabaseSchema(dbUrl);
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
      // L'analyse audio des passages, coupée une fois sur les serveurs d'avant.
      await applyAudioAnalysisDefault();
      // « Accès depuis l'extérieur » allumé une fois pour qui publiait déjà un lien.
      await applyExposureDefault();
    } else {
      console.warn("[DB] All connection attempts failed — entering setup mode");
    }
  } else {
    console.log("[DB] No DATABASE_URL (env or data/database.json) — entering setup mode");
  }

  const state = getAppState();
  console.log(`[App] State: ${state}`);
  // Installation ouverte : un code neuf dans les journaux, et le Jellyfin
  // voisin (pile complète) verrouillé. Le port annoncé est celui de l'hôte.
  bootSetup(process.env.TENTACLE_HOST_PORT || PORT);

  // Watch Together : présence (grâce de déconnexion, délivrance des invites).
  // Inconditionnel — le WS /api/ws est exempté du guard de setup.
  registerWatchTogetherGateway();

  // Start background workers only when fully configured
  if (state === "running") {
    startBackgroundServices();
    // Load plugin backend modules (server-side routes declared by plugins)
    await loadPluginBackends(app);
  }

  // Premier arrêt propre du projet, et il ne sert qu'à ça : le collecteur de
  // temps écrit à chaque relevé, donc au pire quinze secondes sont en jeu — mais
  // rendre son bail permet à un redémarrage de reprendre la mesure aussitôt, au
  // lieu d'attendre l'expiration.
  app.addHook("onClose", async () => {
    stopRecoJobs();
    stopSearchJobs();
    await stopWatchTime();
  });
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void app.close().then(() => process.exit(0));
    });
  }
  // Le redémarrage qu'impose un module serveur de plugin passe par le même
  // arrêt propre, borné (cf. pluginRestart.ts).
  setRestartShutdown(() => app.close());

  await app.listen({ port: PORT, host: HOST });
  console.log(`Tentacle running on http://localhost:${PORT} (state: ${state})`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
