import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import {
  setConfigValue,
  getConfigValue,
  getJellyfinUrl,
  getJellyfinApiKey,
  getDirectStreamingConfig,
  getPublicUrl,
} from "../services/configStore";
import { corsOriginsToInject, injectCorsHosts } from "../services/jellyfinCors";
import { adminUsersRoutes } from "./adminUsers";
import { adminProvisioningRoutes } from "./adminProvisioning";
import { adminJellyfinKeyRoutes } from "./adminJellyfinKey";
import { adminWatchTimeRoutes } from "./adminWatchTime";
import { adminSessionsRoutes } from "./adminSessions";
import { adminServicesRoutes } from "./adminServices";
import { adminJellyfinCompatRoutes } from "./adminJellyfinCompat";
import { adminJellyfinSetupRoutes } from "./adminJellyfinSetup";
import { adminServerLinksRoutes } from "./adminServerLinks";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  // Utilisateurs Jellyfin + impersonation (hérite du hook requireAdmin).
  await app.register(adminUsersRoutes);

  // Code de jumelage de provisionnement (hérite du hook requireAdmin).
  await app.register(adminProvisioningRoutes);

  // Santé de la clé admin Jellyfin (hérite du hook requireAdmin).
  await app.register(adminJellyfinKeyRoutes);

  // Diagnostic du collecteur de temps de visionnage (hérite de requireAdmin).
  await app.register(adminWatchTimeRoutes);

  // Sessions de lecture en direct + salles Watch Together (hérite de requireAdmin).
  await app.register(adminSessionsRoutes);

  // Jellyfin, base de données, réinitialisation (hérite de requireAdmin).
  await app.register(adminServicesRoutes);

  // Compatibilité de Jellyfin : installé, dernier publié, sondes (hérite de requireAdmin).
  await app.register(adminJellyfinCompatRoutes);

  // Réglages recommandés de Jellyfin : état réel et gestes en un clic (hérite de requireAdmin).
  await app.register(adminJellyfinSetupRoutes);

  // Liens du serveur : lien public et lecture directe, sondés (hérite de requireAdmin).
  await app.register(adminServerLinksRoutes);

  /** GET /api/admin/public-url — Read the public server URL (DB value + env fallback). */
  app.get("/public-url", async () => {
    return {
      publicUrl: getConfigValue("public_url") ?? "",
      effectiveUrl: getPublicUrl() ?? "",
      envFallback: (process.env.TENTACLE_PUBLIC_URL ?? "").replace(/\/$/, ""),
    };
  });

  /** PUT /api/admin/public-url — Update the public server URL (stored in DB).
   *  Chaîne vide = effacer la valeur DB → repli sur TENTACLE_PUBLIC_URL. */
  app.put("/public-url", async (request, reply) => {
    const parsed = z
      .object({ publicUrl: z.string().url().or(z.literal("")) })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "URL invalide" });
    }
    await setConfigValue("public_url", parsed.data.publicUrl.replace(/\/$/, ""));
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
      const urlsToInject = corsOriginsToInject(request.headers.origin as string | undefined, getPublicUrl());
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
    const testOrigin = (request.headers.origin as string) || getPublicUrl() || "";

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
};
