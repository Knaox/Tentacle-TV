import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { isFamilyGuest } from "../services/family/familyGuestMarkers";
import { visibleItemIdsFor } from "../services/itemAccess/itemVisibility";
import { getJellyfinUrl } from "../services/configStore";
import { watchLeaderboard } from "../services/leaderboard";
import { favoriteSeries } from "../services/leaderboard/topSeries";

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
    const leaderboard = await watchLeaderboard();
    if (!leaderboard) {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }
    return leaderboard;
  });

  /**
   * GET /api/leaderboard/:userId/top-series — séries les plus regardées d'un
   * compte. Appelé seulement au dépliage d'une ligne : c'est ce qui permet de
   * garder la charge principale légère.
   */
  app.get<{ Params: { userId: string } }>("/:userId/top-series", async (request, reply) => {
    // Un invité de la Famille n'est dans aucune liste : ses séries non plus.
    if (await isFamilyGuest(request.params.userId)) return reply.status(404).send({ message: "Compte inconnu" });
    const series = await favoriteSeries(request.params.userId);
    if (!series) {
      return reply.status(502).send({ message: "Impossible de contacter Jellyfin" });
    }
    // Les séries d'un AUTRE compte, montrées à CE compte : seulement celles
    // que ses droits lui laissent voir (docs/DROITS-UTILISATEURS.md § 5).
    const viewer = (request as FastifyRequest & { user?: JellyfinUser }).user?.userId ?? "";
    const visible = new Set(await visibleItemIdsFor(viewer, series.map((entry) => entry.seriesId)));
    return { userId: request.params.userId, series: series.filter((entry) => visible.has(entry.seriesId)) };
  });
};
