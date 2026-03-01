import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import {
  setConfigValue,
  getJellyfinUrl,
  getJellyfinApiKey,
  setAppState,
} from "../services/configStore";
import { getPrisma } from "../services/db";
import { getDatabaseUrl, saveDatabaseUrl } from "../services/db";

const jellyfinConfigSchema = z.object({
  url: z.string().url(),
  apiKey: z.string().min(1),
});

const dbConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(3306),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
});

function parseDbUrl(url: string): { host: string; port: number; database: string; user: string } | null {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      database: u.pathname.replace(/^\//, ""),
      user: decodeURIComponent(u.username),
    };
  } catch { return null; }
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  /** GET /api/admin/services — Status of all configured services. */
  app.get("/services", async () => {
    const jellyfinUrl = getJellyfinUrl();
    const dbUrl = getDatabaseUrl();

    let jellyfinStatus = "disconnected";
    let jellyfinVersion = "";
    if (jellyfinUrl && getJellyfinApiKey()) {
      try {
        const res = await fetch(`${jellyfinUrl}/System/Info`, {
          headers: { "X-Emby-Token": getJellyfinApiKey()! },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const info = await res.json();
          jellyfinStatus = "connected";
          jellyfinVersion = info.Version || "";
        } else {
          jellyfinStatus = "error";
        }
      } catch {
        jellyfinStatus = "error";
      }
    }

    return {
      jellyfin: {
        status: jellyfinStatus,
        url: jellyfinUrl || "",
        version: jellyfinVersion,
      },
      database: {
        status: dbUrl ? "connected" : "disconnected",
        fromEnv: !!process.env.DATABASE_URL,
        ...(dbUrl ? { fields: parseDbUrl(dbUrl) } : {}),
      },
    };
  });

  /** PUT /api/admin/jellyfin — Update Jellyfin config. */
  app.put("/jellyfin", async (request, reply) => {
    const body = jellyfinConfigSchema.parse(request.body);
    const url = body.url.replace(/\/$/, "");

    // Test connection first
    try {
      const res = await fetch(`${url}/System/Info`, {
        headers: { "X-Emby-Token": body.apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return reply.status(400).send({ message: `Jellyfin a répondu ${res.status}` });
      }
    } catch {
      return reply.status(400).send({ message: "Impossible de contacter Jellyfin" });
    }

    await setConfigValue("jellyfin_url", url);
    await setConfigValue("jellyfin_api_key", body.apiKey);
    return { success: true };
  });

  /** POST /api/admin/test-jellyfin — Test Jellyfin connection. */
  app.post("/test-jellyfin", async (request, reply) => {
    const body = jellyfinConfigSchema.parse(request.body);
    const url = body.url.replace(/\/$/, "");
    try {
      const res = await fetch(`${url}/System/Info`, {
        headers: { "X-Emby-Token": body.apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return reply.status(400).send({ message: "Connexion échouée" });
      const info = await res.json();
      return { success: true, version: info.Version, serverName: info.ServerName };
    } catch {
      return reply.status(400).send({ message: "Serveur injoignable" });
    }
  });

  /** PUT /api/admin/database — Update database connection (requires restart). */
  app.put("/database", async (request, _reply) => {
    const body = dbConfigSchema.parse(request.body);
    const url = `mysql://${body.user}:${encodeURIComponent(body.password)}@${body.host}:${body.port}/${body.database}`;
    saveDatabaseUrl(url);
    return { success: true, message: "Configuration sauvegardée. Redémarrez le serveur pour appliquer." };
  });

  /** POST /api/admin/reset-server — Wipe all config and reset to setup mode. */
  app.post("/reset-server", async (_request, reply) => {
    try {
      const prisma = getPrisma();
      // Wipe all server config rows
      await prisma.serverConfig.deleteMany({});
      // Reset in-memory state to setup mode
      setAppState(process.env.DATABASE_URL ? "setup_jellyfin" : "setup_db");
      return { success: true, message: "Serveur réinitialisé. Rechargez la page." };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(500).send({ message: msg });
    }
  });
};
