import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  deleteConfigValue,
  getDirectStreamingConfig,
  getJellyfinApiKey,
  getJellyfinUrl,
  getPublicUrl,
  setConfigValue,
} from "../services/configStore";
import { corsOriginsToInject, injectCorsHosts } from "../services/jellyfinCors";

/**
 * La lecture directe (`/api/admin/direct-streaming`, sous `requireAdmin`) :
 * les applications lisent chez Jellyfin sans passer par Tentacle. L'adresse
 * PRIVÉE (réseau local) suffit à l'allumer ; la PUBLIQUE est facultative —
 * sans elle, hors de la maison, la lecture passe par Tentacle. Les mêmes
 * règles que l'étape « Accès à distance » de l'assistant.
 */
export const adminDirectStreamingRoutes: FastifyPluginAsync = async (app) => {
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
    // L'adresse PRIVÉE suffit à allumer la lecture directe (réseau local) ; la
    // publique est facultative — `null` l'efface : hors de la maison, la
    // lecture passe alors par Tentacle. Une chaîne vide la laisse telle quelle
    // (les clients d'avant l'envoient ainsi).
    const schema = z.object({
      enabled: z.boolean(),
      publicUrl: z.string().url().optional().or(z.literal("")).nullable(),
      privateUrl: z.string().url().optional().or(z.literal("")),
    }).refine(
      (d) => !d.enabled || !!d.privateUrl || !!getDirectStreamingConfig().privateUrl,
      { message: "privateUrl is required when enabled" }
    );

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: parsed.error.issues[0].message });
    }
    const body = parsed.data;

    await setConfigValue("direct_streaming_enabled", String(body.enabled));
    if (body.publicUrl) {
      await setConfigValue("jellyfin_public_url", body.publicUrl.replace(/\/$/, ""));
    } else if (body.publicUrl === null) {
      await deleteConfigValue("jellyfin_public_url");
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
};
