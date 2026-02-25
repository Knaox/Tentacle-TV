import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { execSync } from "child_process";
import { resolve } from "path";
import {
  hasDatabaseUrl,
  getDatabaseUrl,
  saveDatabaseUrl,
  initPrisma,
  reinitPrisma,
  hasPrisma,
} from "../services/db";
import {
  detectAppState,
  getAppState,
  setAppState,
  setConfigValue,
  getConfigValue,
} from "../services/configStore";

const testDbSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(3306),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
});

const testJellyfinSchema = z.object({
  url: z.string().url(),
  apiKey: z.string().min(1),
});

const createAdminSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const setupRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/setup/status — Current setup state. */
  app.get("/status", async () => {
    const state = getAppState();
    const hasDbUrl = hasDatabaseUrl();
    return { state, hasDbUrl, dbFromEnv: !!process.env.DATABASE_URL, dbConnected: hasPrisma() };
  });

  /** POST /api/setup/test-db — Test DB connection with provided credentials. */
  app.post("/test-db", async (request, reply) => {
    const body = testDbSchema.parse(request.body);
    const url = `mysql://${body.user}:${encodeURIComponent(body.password)}@${body.host}:${body.port}/${body.database}`;

    const ok = await reinitPrisma(url);
    if (!ok) {
      return reply.status(400).send({ message: "Impossible de se connecter à la base de données" });
    }

    // Persist so it survives restarts and set in current process
    saveDatabaseUrl(url);
    process.env.DATABASE_URL = url;
    return { success: true };
  });

  /** POST /api/setup/migrate — Run Prisma migrations to create tables. */
  app.post("/migrate", async (_request, reply) => {
    const dbUrl = getDatabaseUrl();
    if (!dbUrl) {
      return reply.status(400).send({ message: "Base de données non configurée" });
    }

    // If Prisma isn't initialized yet (had a DB URL but not connected)
    if (!hasPrisma()) {
      const ok = await initPrisma(dbUrl);
      if (!ok) {
        return reply.status(400).send({ message: "Connexion à la base de données échouée" });
      }
    }

    try {
      // Set in current process so child reliably inherits (avoids .env override)
      process.env.DATABASE_URL = dbUrl;
      execSync("npx prisma db push", {
        cwd: resolve(__dirname, "../.."),
        env: { ...process.env, DATABASE_URL: dbUrl },
        timeout: 30_000,
        stdio: "pipe",
      });

      // Re-detect state after migration
      await detectAppState();
      return { success: true, state: getAppState() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ message: `Migration échouée: ${msg}` });
    }
  });

  /** POST /api/setup/test-jellyfin — Test Jellyfin connection. */
  app.post("/test-jellyfin", async (request, reply) => {
    const body = testJellyfinSchema.parse(request.body);
    const url = body.url.replace(/\/$/, "");

    try {
      const res = await fetch(`${url}/System/Info`, {
        headers: { "X-Emby-Token": body.apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return reply.status(400).send({ message: `Jellyfin a répondu ${res.status}` });
      }
      const info = await res.json();
      return { success: true, version: info.Version, serverName: info.ServerName };
    } catch {
      return reply.status(400).send({ message: "Impossible de contacter le serveur Jellyfin" });
    }
  });

  /** POST /api/setup/save-jellyfin — Save Jellyfin URL and API key. */
  app.post("/save-jellyfin", async (request, reply) => {
    const body = testJellyfinSchema.parse(request.body);
    const url = body.url.replace(/\/$/, "");

    try {
      await setConfigValue("jellyfin_url", url);
      await setConfigValue("jellyfin_api_key", body.apiKey);
      await detectAppState();
      return { success: true, state: getAppState() };
    } catch (err) {
      return reply.status(500).send({ message: "Échec de la sauvegarde" });
    }
  });

  /** POST /api/setup/create-admin — Verify Jellyfin credentials and create admin. */
  app.post("/create-admin", async (request, reply) => {
    const body = createAdminSchema.parse(request.body);
    const jellyfinUrl = getConfigValue("jellyfin_url");
    if (!jellyfinUrl) {
      return reply.status(400).send({ message: "Jellyfin non configuré" });
    }

    try {
      // Authenticate via Jellyfin
      const authHeader = `MediaBrowser Client="Tentacle", Device="Server", DeviceId="tentacle-setup", Version="0.5.0"`;
      const authRes = await fetch(`${jellyfinUrl}/Users/AuthenticateByName`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Emby-Authorization": authHeader,
        },
        body: JSON.stringify({ Username: body.username, Pw: body.password }),
      });
      if (!authRes.ok) {
        return reply.status(400).send({ message: "Identifiants Jellyfin invalides" });
      }

      const authData = await authRes.json();
      const user = authData.User;

      // Verify admin status
      if (!user?.Policy?.IsAdministrator) {
        return reply.status(400).send({ message: "Ce compte n'est pas administrateur Jellyfin" });
      }

      // Save admin info and mark setup as complete
      await setConfigValue("admin_jellyfin_id", user.Id);
      await setConfigValue("admin_username", user.Name);
      await setConfigValue("setup_completed", "true");
      setAppState("running");

      return {
        success: true,
        user: { Id: user.Id, Name: user.Name, Policy: user.Policy },
        token: authData.AccessToken,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes("invalides")) throw err;
      return reply.status(500).send({ message: "Erreur lors de la vérification" });
    }
  });
};
