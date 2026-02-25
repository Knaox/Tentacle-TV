import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { resolve } from "path";
import { existsSync } from "fs";

import { initPrisma, hasDatabaseUrl, getDatabaseUrl, reconnectPrisma } from "./services/db";
import { detectAppState, getAppState } from "./services/configStore";

import { setupRoutes } from "./routes/setup";
import { authRoutes } from "./routes/auth";
import { inviteRoutes } from "./routes/invites";
import { healthRoutes } from "./routes/health";
import { configRoutes } from "./routes/config";
import { demoRoutes } from "./routes/demo";
import { seerrRoutes } from "./routes/seerr";
import { requestRoutes } from "./routes/requests";
import { preferenceRoutes } from "./routes/preferences";
import { updateRoutes } from "./routes/update";
import { ticketRoutes } from "./routes/tickets";
import { notificationRoutes } from "./routes/notifications";
import { jellyfinProxyRoutes } from "./routes/jellyfinProxy";
import { adminRoutes } from "./routes/admin";
import { pairRoutes } from "./routes/pair";
import { startRequestWorker } from "./services/requestWorker";
import { startPairingCleanup } from "./services/pairingCleanup";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const RATE_LIMIT = Number(process.env.RATE_LIMIT) || 1000;

async function main() {
  const app = Fastify({
    logger: true,
    // Allow large bodies for proxied requests (images, etc.)
    bodyLimit: 50 * 1024 * 1024,
    // Trust X-Forwarded-* headers from reverse proxy (nginx) for real client IP
    trustProxy: true,
  });

  // CORS: "*" reflects any origin (needed for Desktop/Mobile apps).
  // Set CORS_ORIGIN to a specific URL or comma-separated list to restrict.
  const corsOrigin = CORS_ORIGIN === "*"
    ? true
    : CORS_ORIGIN.includes(",") ? CORS_ORIGIN.split(",").map((s) => s.trim()) : CORS_ORIGIN;
  await app.register(cors, { origin: corsOrigin });
  await app.register(rateLimit, { max: RATE_LIMIT, timeWindow: "1 minute" });

  // Override default JSON parser to tolerate empty bodies (fixes DELETE with Content-Type: application/json)
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      const str = typeof body === "string" ? body : "";
      if (!str.trim()) { done(null, undefined); return; }
      try { done(null, JSON.parse(str)); } catch (err) { done(err as Error, undefined); }
    }
  );

  // Content type parser for raw binary (proxied bodies)
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body)
  );

  // ── Setup routes (always available) ──
  await app.register(setupRoutes, { prefix: "/api/setup" });
  await app.register(healthRoutes, { prefix: "/api" });

  // ── Setup guard: block most API routes until setup is complete ──
  let lastRecoveryAttempt = 0;
  app.addHook("onRequest", async (request, reply) => {
    const url = request.url;
    // Always allow: setup, health, static files
    if (url.startsWith("/api/setup") || url.startsWith("/api/health") || !url.startsWith("/api/")) {
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
              startRequestWorker();
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
  await app.register(seerrRoutes, { prefix: "/api/seerr" });
  await app.register(requestRoutes, { prefix: "/api/requests" });
  await app.register(preferenceRoutes, { prefix: "/api/preferences" });
  await app.register(updateRoutes, { prefix: "/api/update" });
  await app.register(ticketRoutes, { prefix: "/api/tickets" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(pairRoutes, { prefix: "/api/pair" });
  await app.register(configRoutes, { prefix: "/api" });
  await app.register(demoRoutes, { prefix: "/api" });

  // ── Jellyfin proxy (all Jellyfin API calls go through here) ──
  await app.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });

  // ── Serve frontend static files in production ──
  const webDistPath = resolve(__dirname, "../../../web/dist");
  if (existsSync(webDistPath)) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: "/",
      wildcard: false,
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

  // Start background workers only when fully configured
  if (state === "running") {
    startRequestWorker();
    startPairingCleanup();
  }

  await app.listen({ port: PORT, host: HOST });
  console.log(`Tentacle running on http://localhost:${PORT} (state: ${state})`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
