import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../middleware/auth";
import { getJellyfinUrl } from "../services/configStore";
import { classementVisionnage } from "../services/leaderboard";
import { seriesFavorites } from "../services/leaderboard/topSeries";

/**
 * Classement de visionnage — ouvert à TOUT utilisateur authentifié, et donc
 * délibérément enregistré hors de `/api/admin`.
 *
 * C'est un choix assumé : partout ailleurs, le code réserve aux administrateurs
 * la moindre vue sur les autres comptes. Ici l'objet même de la fonction est de
 * se comparer entre proches, ce qui n'a aucun sens si chacun ne voit que soi.
 *
 * La projection reste minimale, dans l'esprit de `watchTogetherUsers.ts` :
 * identifiant, nom, avatar et chiffres de visionnage. Jamais de rôle, jamais de
 * politique Jellyfin, jamais d'adresse. Le calcul se fait entièrement côté
 * serveur avec la clé d'administration, dont rien ne sort.
 */
export const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  /** GET /api/leaderboard — classement complet, mis en cache 5 min. */
  app.get("/", async (_request, reply) => {
    if (!getJellyfinUrl()) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }
    const classement = await classementVisionnage();
    if (!classement) {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }
    return classement;
  });

  /**
   * GET /api/leaderboard/:userId/top-series — séries les plus regardées d'un
   * compte. Appelé seulement au dépliage d'une ligne : c'est ce qui permet de
   * garder la charge principale légère.
   */
  app.get<{ Params: { userId: string } }>("/:userId/top-series", async (request, reply) => {
    const series = await seriesFavorites(request.params.userId);
    if (!series) {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }
    return { userId: request.params.userId, series };
  });
};
