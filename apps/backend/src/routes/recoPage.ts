import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { servePage } from "../services/reco/pageService";
import { providerFilterFromQuery } from "../services/reco/providerFilter";

/**
 * GET /api/reco/page?providers=283,415 — LA page de recommandations en une
 * requête : état du moteur, drapeaux, et toutes les rangées avec leurs
 * items, depuis le snapshot précalculé. Le filtre (ids TMDB principaux,
 * virgule ou +) est canonisé ; absent = toutes les plateformes.
 */
export const recoPageRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/page", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const query = request.query as { providers?: unknown };
    return servePage(user.userId, providerFilterFromQuery(query.providers));
  });
};
