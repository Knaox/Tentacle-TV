import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { resolve } from "path";
import { existsSync } from "fs";
import { ZodError } from "zod";
import websocket from "@fastify/websocket";

import { initPrisma, hasDatabaseUrl, getDatabaseUrl, reconnectPrisma } from "./services/db";
import { detectAppState, getAppState } from "./services/configStore";

import { setupRoutes } from "./routes/setup";
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
import { adminRoutes } from "./routes/admin";
import { pluginRoutes } from "./routes/plugins";
import { pairRoutes } from "./routes/pair";
import { shareRoutes } from "./routes/share";
import { tmdbRoutes } from "./routes/tmdb";
import { trailerRoutes } from "./routes/trailers";
import { gifRoutes } from "./routes/gifs";
import { themeRoutes } from "./routes/theme";
import { wsRoutes } from "./routes/ws";
import { watchTogetherRoutes } from "./routes/watchTogether";
import { watchTogetherInviteRoutes } from "./routes/watchTogetherInvites";
import { watchTogetherUsersRoutes } from "./routes/watchTogetherUsers";
import { startPairingCleanup } from "./services/pairingCleanup";
import { startJellyfinPoller } from "./services/jellyfinPoller";
import { startJellyfinWs } from "./services/jellyfinWs";
import { startNotificationPushWorker } from "./services/notificationPushWorker";
import { startLibraryAddedNotifier } from "./services/libraryAddedNotifier";
import { startAnnouncedPurge } from "./services/announcedRegistry";
import { loadPluginBackends } from "./services/pluginBackendLoader";
import { registerWatchTogetherGateway } from "./services/watchTogether/gateway";
import { registerBodyParsers } from "./services/bodyParsers";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const RATE_LIMIT = Number(process.env.RATE_LIMIT) || 1000;

async function main() {
  const app = Fastify({
    logger: {
      serializers: {
        req(request) {
          const cf = request.headers?.["cf-connecting-ip"];
          const realIp = request.headers?.["x-real-ip"];
          const clientIp = (typeof cf === "string" && cf) ? cf
            : (typeof realIp === "string" && realIp) ? realIp
            : request.raw?.socket?.remoteAddress ?? "";
          return {
            method: request.method,
            url: request.url,
            host: request.headers?.host,
            remoteAddress: clientIp,
            remotePort: request.raw?.socket?.remotePort,
          };
        },
      },
    },
    // Allow large bodies for proxied requests (images, etc.)
    bodyLimit: 50 * 1024 * 1024,
    // Trust X-Forwarded-* headers from reverse proxy (nginx) for real client IP
    trustProxy: true,
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
  // Origines des webviews de l'app desktop (Tauri) — toujours autorisées car
  // émises uniquement par l'app native, jamais par un navigateur tiers.
  // macOS (WKWebView) → tauri://localhost ; Windows (WebView2) → https://tauri.localhost.
  const TAURI_ORIGINS = ["tauri://localhost", "https://tauri.localhost", "http://tauri.localhost"];
  await app.register(cors, {
    origin: corsOrigins?.length
      ? (origin, cb) => {
          // Allow requests with no origin (mobile apps, curl, server-to-server)
          if (!origin) return cb(null, true);
          if (corsOrigins.includes(origin) || TAURI_ORIGINS.includes(origin)) return cb(null, true);
          cb(new Error("CORS origin not allowed"), false);
        }
      : true,
    credentials: true,
  });

  await app.register(compress, { threshold: 1024 });
  await app.register(rateLimit, { max: RATE_LIMIT, timeWindow: "1 minute" });
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
  await app.register(setupRoutes, { prefix: "/api/setup" });
  await app.register(healthRoutes, { prefix: "/api" });

  // ── Theme routes (always available — clients need them pre-setup to boot) ──
  await app.register(themeRoutes, { prefix: "/api/theme" });

  // ── Setup guard: block most API routes until setup is complete ──
  let lastRecoveryAttempt = 0;
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
            state = await detectAppState();
            if (state === "running") {
              console.log("[Guard] Auto-recovery succeeded — state is now running");
              startPairingCleanup();
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
  await app.register(pluginRoutes, { prefix: "/api/plugins" });
  await app.register(pairRoutes, { prefix: "/api/pair" });
  await app.register(shareRoutes, { prefix: "/api/share" });
  await app.register(tmdbRoutes, { prefix: "/api/tmdb" });
  await app.register(trailerRoutes, { prefix: "/api/trailers" });
  await app.register(gifRoutes, { prefix: "/api/gifs" });
  await app.register(wsRoutes, { prefix: "/api/ws" });
  await app.register(watchTogetherRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherInviteRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherUsersRoutes, { prefix: "/api/watch-together" });
  await app.register(configRoutes, { prefix: "/api" });
  await app.register(demoRoutes, { prefix: "/api" });

  // ── Jellyfin trickplay tiles (specific route — must register BEFORE the wildcard proxy) ──
  await app.register(jellyfinTrickplayRoutes, { prefix: "/api/jellyfin" });

  // ── Jellyfin proxy (all Jellyfin API calls go through here) ──
  await app.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });

  // ── Serve frontend static files in production ──
  const webDistPath = resolve(__dirname, "../../web/dist");
  if (existsSync(webDistPath)) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: "/",
    });
    // SPA fallback: serve index.html for all non-API routes
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.status(404).send({ message: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  // ── Initialize database (with retry for Docker Compose / slow DB starts) ──
  const dbUrl = getDatabaseUrl();
  const dbSource = process.env.DATABASE_URL ? "env" : dbUrl ? "file (data/database.json)" : "none";
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
      await detectAppState();
    } else {
      console.warn("[DB] All connection attempts failed — entering setup mode");
    }
  } else {
    console.log("[DB] No DATABASE_URL (env or data/database.json) — entering setup mode");
  }

  const state = getAppState();
  console.log(`[App] State: ${state}`);

  // Watch Together : présence (grâce de déconnexion, délivrance des invites).
  // Inconditionnel — le WS /api/ws est exempté du guard de setup.
  registerWatchTogetherGateway();

  // Start background workers only when fully configured
  if (state === "running") {
    startPairingCleanup();
    startJellyfinPoller();
    startJellyfinWs();
    startNotificationPushWorker();
    startLibraryAddedNotifier();
    startAnnouncedPurge();
    // Load plugin backend modules (server-side routes declared by plugins)
    await loadPluginBackends(app);
  }

  await app.listen({ port: PORT, host: HOST });
  console.log(`Tentacle running on http://localhost:${PORT} (state: ${state})`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
