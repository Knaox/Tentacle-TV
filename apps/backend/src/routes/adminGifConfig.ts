import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { deleteConfigValue, getConfigValue, setConfigValue } from "../services/configStore";

/**
 * Config GIFs du chat Watch Together (clé API Tenor) — enregistré par admin.ts
 * (hérite du hook requireAdmin et du préfixe /api/admin, comme adminProvisioning).
 *
 * La clé n'est JAMAIS renvoyée au frontend : seuls les états configuré /
 * source (DB ou variable d'env TENOR_API_KEY) le sont. Le PUT valide la clé
 * par un appel réel à Tenor avant de la sauvegarder.
 */

const gifConfigSchema = z.object({
  apiKey: z.string().min(10).max(200),
});

export const adminGifConfigRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/gif-config — état de configuration (jamais la clé). */
  app.get("/gif-config", async () => {
    const dbConfigured = !!getConfigValue("tenor_api_key");
    const envFallback = !!process.env.TENOR_API_KEY;
    return { configured: dbConfigured || envFallback, dbConfigured, envFallback };
  });

  /** PUT /api/admin/gif-config — teste la clé contre Tenor PUIS la sauvegarde. */
  app.put("/gif-config", async (request, reply) => {
    const body = gifConfigSchema.parse(request.body);

    try {
      const params = new URLSearchParams({
        key: body.apiKey,
        client_key: "tentacle_tv",
        q: "test",
        limit: "1",
      });
      const res = await fetch(`https://tenor.googleapis.com/v2/search?${params.toString()}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        return reply.status(400).send({ message: `Clé refusée par Tenor (HTTP ${res.status})` });
      }
    } catch {
      return reply.status(400).send({ message: "Tenor injoignable" });
    }

    await setConfigValue("tenor_api_key", body.apiKey);
    return { success: true };
  });

  /** DELETE /api/admin/gif-config — efface la clé DB (le repli env subsiste). */
  app.delete("/gif-config", async () => {
    await deleteConfigValue("tenor_api_key");
    return { success: true, envFallback: !!process.env.TENOR_API_KEY };
  });
};
