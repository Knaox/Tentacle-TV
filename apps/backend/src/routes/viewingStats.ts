import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { getJellyfinUrl } from "../services/configStore";
import { getViewingStats } from "../services/viewingStats";
import { JellyfinUnavailable } from "../services/viewingStats/jellyfinScan";
import { resolveTimeZone } from "../services/viewingStats/localCalendar";

const statsQuery = z.object({
  period: z.enum(["30d", "year", "all"]).catch("all"),
  // Fuseau IANA du client (« Europe/Paris ») : les jours et les heures sont les SIENS.
  tz: z.string().max(64).optional().catch(undefined),
  lang: z.enum(["fr", "en"]).catch("fr"),
  refresh: z.enum(["1", "true"]).optional().catch(undefined),
});

/**
 * Statistiques de visionnage — celles du compte appelant, JAMAIS d'un autre :
 * l'identifiant vient du jeton, aucun paramètre ne le désigne. Le calcul se
 * fait côté serveur avec la clé d'administration, dont rien ne sort ; la
 * réponse ne porte que des chiffres, des titres et des étiquettes d'images.
 */
export const viewingStatsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  /** GET /api/stats/me?period=30d|year|all&tz=<IANA>&lang=fr|en[&refresh=1] */
  app.get("/me", async (request, reply) => {
    if (!getJellyfinUrl()) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }
    const user = (request as any).user as JellyfinUser;
    const q = statsQuery.parse(request.query);
    try {
      return await getViewingStats(user.userId, {
        period: q.period,
        timeZone: resolveTimeZone(q.tz),
        lang: q.lang,
        refresh: q.refresh !== undefined,
      });
    } catch (err) {
      if (err instanceof JellyfinUnavailable) {
        return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
      }
      throw err;
    }
  });
};
