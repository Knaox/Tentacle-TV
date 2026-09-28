import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";
import { findLibraryItemByTmdb } from "../services/jellyfinTmdbLookup";
import { likeItemForUser, unlikeItemForUser } from "../services/jellyfinLikes";
import { pendingKey } from "../services/watchlistPending";
import { broadcastToUser } from "../services/wsManager";
import { pokeProfile } from "../services/reco/jobs";

/** Posé avec la clé admin, le like n'est pas relayé par le WS Jellyfin : on
 *  prévient les autres écrans du compte, et le moteur de reco. */
function listChanged(userId: string): void {
  broadcastToUser(userId, "watchlist");
  pokeProfile(userId);
}

// Vocabulaire TMDB, celui des clés de recommandation (« movie:603 », « tv:1399 »).
const mediaTypeSchema = z.enum(["movie", "tv"]);
const tmdbIdSchema = z.coerce.number().int().min(1).max(2_147_483_647);
const bodySchema = z.object({ mediaType: mediaTypeSchema, tmdbId: tmdbIdSchema });
const paramsSchema = z.object({ mediaType: mediaTypeSchema, tmdbId: tmdbIdSchema });

/** L'utilisateur posé par `requireAuth` (hook du parent, routes/watchlist.ts). */
function userOf(request: FastifyRequest): JellyfinUser {
  return (request as FastifyRequest & { user: JellyfinUser }).user;
}

/**
 * « Ma liste » par identité TMDB — pour les cartes qui n'ont pas d'item
 * Jellyfin sous la main (recommandation hors bibliothèque, résultat de
 * recherche d'une extension, affiche de l'extension de demandes) :
 *
 *   GET    /pending               — les titres mis de côté, pas encore arrivés
 *   PUT    /tmdb                  — mettre un titre dans Ma liste : déjà dans la
 *                                   bibliothèque, il y entre tout de suite
 *                                   (`listed`) ; sinon il est mis de côté et y
 *                                   entrera à son arrivée (`pending`)
 *   DELETE /tmdb/:mediaType/:id   — l'en retirer, qu'il soit arrivé ou non
 *
 * Le like est posé pour le compte de l'utilisateur avec la clé admin, comme
 * la remise des séries retirées automatiquement. Jellyfin injoignable au
 * moment du geste : le titre est mis de côté, le balayage de
 * services/watchlistPending.ts le rattrapera s'il était déjà là.
 */
export const watchlistTmdbRoutes: FastifyPluginAsync = async (app) => {
  app.get("/pending", async (request) => {
    const user = userOf(request);
    const rows = await getPrisma().watchlistPending.findMany({
      where: { jellyfinUserId: user.userId },
      orderBy: { createdAt: "desc" },
      select: { mediaType: true, tmdbId: true },
    });
    return rows.map((r) => pendingKey(r.mediaType as "movie" | "tv", r.tmdbId));
  });

  app.put("/tmdb", async (request) => {
    const user = userOf(request);
    const { mediaType, tmdbId } = bodySchema.parse(request.body);
    const lookup = await findLibraryItemByTmdb(tmdbId, mediaType);
    if (lookup.kind === "found" && (await likeItemForUser(user.userId, lookup.id))) {
      // Une ligne d'avant (mise de côté puis arrivée) n'a plus d'objet.
      await getPrisma().watchlistPending.deleteMany({ where: { jellyfinUserId: user.userId, mediaType, tmdbId } });
      listChanged(user.userId);
      return { state: "listed" as const, itemId: lookup.id };
    }
    await getPrisma().watchlistPending.upsert({
      where: { jellyfinUserId_mediaType_tmdbId: { jellyfinUserId: user.userId, mediaType, tmdbId } },
      create: { jellyfinUserId: user.userId, mediaType, tmdbId },
      update: {},
    });
    return { state: "pending" as const };
  });

  app.delete("/tmdb/:mediaType/:tmdbId", async (request) => {
    const user = userOf(request);
    const { mediaType, tmdbId } = paramsSchema.parse(request.params);
    const removed = await getPrisma().watchlistPending.deleteMany({
      where: { jellyfinUserId: user.userId, mediaType, tmdbId },
    });
    // Mis de côté, il n'était pas encore là : rien à défaire chez Jellyfin.
    if (removed.count > 0) return { state: "none" as const };
    const lookup = await findLibraryItemByTmdb(tmdbId, mediaType);
    if (lookup.kind === "found") {
      if (!(await unlikeItemForUser(user.userId, lookup.id))) throw new Error("Jellyfin n'a pas retiré le titre de Ma liste");
      listChanged(user.userId);
    }
    return { state: "none" as const };
  });
};
