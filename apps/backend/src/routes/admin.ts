import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import {
  setConfigValue,
  getConfigValue,
  getJellyfinUrl,
  getJellyfinApiKey,
  setAppState,
  getDirectStreamingConfig,
} from "../services/configStore";
import { getPrisma } from "../services/db";
import { injectCorsHosts } from "../services/jellyfinCors";
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

  /** GET /api/admin/playback — Read playback settings. */
  app.get("/playback", async () => {
    const v = getConfigValue("autoplay_credits_minutes");
    return { autoplayCreditsMinutes: v != null ? Number(v) : 2 };
  });

  /** PUT /api/admin/playback — Update playback settings. */
  app.put("/playback", async (request) => {
    const body = z.object({ autoplayCreditsMinutes: z.number().min(0).max(30) }).parse(request.body);
    await setConfigValue("autoplay_credits_minutes", String(body.autoplayCreditsMinutes));
    return { success: true };
  });

  /** GET /api/admin/direct-streaming — Read direct streaming settings. */
  app.get("/direct-streaming", async () => {
    const cfg = getDirectStreamingConfig();
    return {
      enabled: cfg.enabled,
      publicUrl: cfg.publicUrl ?? "",
      privateUrl: cfg.privateUrl ?? "",
    };
  });

  /** PUT /api/admin/direct-streaming — Update direct streaming settings. */
  app.put("/direct-streaming", async (request, reply) => {
    const schema = z.object({
      enabled: z.boolean(),
      publicUrl: z.string().url().optional().or(z.literal("")),
      privateUrl: z.string().url().optional().or(z.literal("")),
    }).refine(
      (d) => !d.enabled || (!!d.publicUrl && !!d.privateUrl),
      { message: "Both publicUrl and privateUrl are required when enabled" }
    );

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: parsed.error.issues[0].message });
    }
    const body = parsed.data;

    await setConfigValue("direct_streaming_enabled", String(body.enabled));
    if (body.publicUrl) {
      await setConfigValue("jellyfin_public_url", body.publicUrl.replace(/\/$/, ""));
    }
    if (body.privateUrl) {
      await setConfigValue("jellyfin_private_url", body.privateUrl.replace(/\/$/, ""));
    }

    // Injection CORS pour le direct streaming (non-bloquant)
    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();
    if (jellyfinUrl && apiKey && body.enabled) {
      const tentacleOrigin = (request.headers.origin as string) || process.env.TENTACLE_PUBLIC_URL;
      const urlsToInject = [tentacleOrigin].filter(Boolean) as string[];
      try {
        const result = await injectCorsHosts(jellyfinUrl, apiKey, urlsToInject, request.log);
        if (result.added.length) request.log.info({ added: result.added }, "CORS hosts injected");
      } catch (err) {
        request.log.warn({ error: err }, "CORS injection failed (non-blocking)");
      }
    }

    return { success: true };
  });

  /** POST /api/admin/test-direct-streaming — Test connectivity to Jellyfin URLs from the server. */
  app.post("/test-direct-streaming", async (request) => {
    const body = z.object({
      publicUrl: z.string().url().optional().or(z.literal("")),
      privateUrl: z.string().url().optional().or(z.literal("")),
    }).parse(request.body);

    // Origin header to send so Jellyfin returns CORS headers (server-to-server fetch has no Origin by default)
    const testOrigin = (request.headers.origin as string) || process.env.TENTACLE_PUBLIC_URL || "";

    const test = async (url: string): Promise<{ ok: boolean; version?: string; error?: string; corsOk?: boolean }> => {
      if (!url) return { ok: false, error: "URL vide" };
      try {
        const headers: Record<string, string> = {};
        if (testOrigin) headers["Origin"] = testOrigin;
        const res = await fetch(`${url.replace(/\/$/, "")}/System/Info/Public`, {
          headers,
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const info = await res.json();

        // Check if Jellyfin sends CORS headers (required for browser direct streaming)
        const acao = res.headers.get("access-control-allow-origin");
        const corsOk = acao === "*" || (!!acao && acao.length > 0);

        return { ok: true, version: info.Version, corsOk };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unreachable" };
      }
    };

    const [pub, priv] = await Promise.all([
      body.publicUrl ? test(body.publicUrl) : Promise.resolve(null),
      body.privateUrl ? test(body.privateUrl) : Promise.resolve(null),
    ]);

    return { public: pub, private: priv };
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
