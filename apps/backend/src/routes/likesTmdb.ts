import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";
import { findLibraryItemByTmdb } from "../services/jellyfinTmdbLookup";
import { favoriteItemForUser, unfavoriteItemForUser } from "../services/jellyfinLikes";
import { dropPendingFlag, holdPendingFlag, likeMediaType, pendingKey } from "../services/watchlistPending";
import { patchLibraryMemo } from "../services/reco/candidates/libraryMemo";
import { broadcastToUser } from "../services/wsManager";
import { pokeProfile } from "../services/reco/jobs";

// Vocabulaire TMDB, celui des clés de recommandation (« movie:603 », « tv:1399 »).
const mediaTypeSchema = z.enum(["movie", "tv"]);
const tmdbIdSchema = z.coerce.number().int().min(1).max(2_147_483_647);
const bodySchema = z.object({ mediaType: mediaTypeSchema, tmdbId: tmdbIdSchema });
const paramsSchema = z.object({ mediaType: mediaTypeSchema, tmdbId: tmdbIdSchema });

type TmdbMediaType = z.infer<typeof mediaTypeSchema>;

/** L'utilisateur posé par `requireAuth` (hook du parent, routes/likes.ts). */
function userOf(request: FastifyRequest): JellyfinUser {
  return (request as FastifyRequest & { user: JellyfinUser }).user;
}

/** Posé à la clé admin, le cœur n'est pas relayé par le WS Jellyfin : on
 *  prévient les autres écrans du compte, l'index de la reco et son goût. */
function favoritesChanged(userId: string, mediaType: TmdbMediaType, tmdbId: number, isFavorite: boolean): void {
  patchLibraryMemo(userId, pendingKey(mediaType, tmdbId), { isFavorite });
  broadcastToUser(userId, "favorites");
  pokeProfile(userId);
}

/** Défait le « j'aime » d'un titre absent — le like du catalogue ET le cœur qui
 *  attendait son arrivée. Vrai s'il y avait l'un ou l'autre. */
async function dropOffLibraryLike(userId: string, mediaType: TmdbMediaType, tmdbId: number): Promise<boolean> {
  const [pending, likes] = await Promise.all([
    dropPendingFlag(userId, mediaType, tmdbId, "favorite"),
    getPrisma().userLike.deleteMany({ where: { jellyfinUserId: userId, mediaType: likeMediaType(mediaType), tmdbId } }),
  ]);
  return pending || likes.count > 0;
}

/**
 * « J'aime » par identité TMDB — pour les cartes qui n'ont pas d'item Jellyfin
 * sous la main (recommandation hors bibliothèque, résultat d'une extension,
 * affiche de l'extension de demandes) :
 *
 *   GET    /pending               — les titres aimés, pas encore arrivés
 *   PUT    /tmdb                  — aimer un titre : déjà dans la bibliothèque,
 *                                   le cœur est posé tout de suite (`favorited`) ;
 *                                   sinon c'est un like du catalogue — le goût
 *                                   de la reco le lit sur-le-champ (ancre,
 *                                   graine, exclusion) — et le cœur attend son
 *                                   arrivée (`pending`, drapeau « favorite » de
 *                                   watchlist_pending, qui efface le like)
 *   DELETE /tmdb/:mediaType/:id   — ne plus l'aimer, qu'il soit arrivé ou non
 *
 * Le « j'aime » d'Affiner qui attend son titre (même drapeau) se lit ici
 * aussi : c'est le même cœur. Son verdict, lui, reste à Affiner.
 */
export const likesTmdbRoutes: FastifyPluginAsync = async (app) => {
  app.get("/pending", async (request) => {
    const user = userOf(request);
    const prisma = getPrisma();
    const [pending, likes] = await Promise.all([
      prisma.watchlistPending.findMany({
        where: { jellyfinUserId: user.userId, flag: "favorite" },
        orderBy: { createdAt: "desc" },
        select: { mediaType: true, tmdbId: true },
      }),
      prisma.userLike.findMany({
        where: { jellyfinUserId: user.userId },
        orderBy: { createdAt: "desc" },
        select: { mediaType: true, tmdbId: true },
      }),
    ]);
    const keys = new Set<string>();
    for (const r of pending) keys.add(pendingKey(r.mediaType === "movie" ? "movie" : "tv", r.tmdbId));
    for (const l of likes) keys.add(pendingKey(l.mediaType === "movie" ? "movie" : "tv", l.tmdbId));
    return [...keys];
  });

  app.put("/tmdb", async (request) => {
    const user = userOf(request);
    const { mediaType, tmdbId } = bodySchema.parse(request.body);
    const lookup = await findLibraryItemByTmdb(tmdbId, mediaType);
    if (lookup.kind === "found" && (await favoriteItemForUser(user.userId, lookup.id))) {
      // Il est là : le cœur porte le « j'aime », plus rien n'attend son arrivée.
      await dropOffLibraryLike(user.userId, mediaType, tmdbId);
      favoritesChanged(user.userId, mediaType, tmdbId, true);
      return { state: "favorited" as const, itemId: lookup.id };
    }
    // Absent — ou Jellyfin muet : le balayage posera le cœur s'il était là.
    await Promise.all([
      getPrisma().userLike.upsert({
        where: { jellyfinUserId_mediaType_tmdbId: { jellyfinUserId: user.userId, mediaType: likeMediaType(mediaType), tmdbId } },
        create: { jellyfinUserId: user.userId, mediaType: likeMediaType(mediaType), tmdbId },
        update: {},
      }),
      holdPendingFlag(user.userId, mediaType, tmdbId, "favorite"),
    ]);
    pokeProfile(user.userId);
    return { state: "pending" as const };
  });

  app.delete("/tmdb/:mediaType/:tmdbId", async (request) => {
    const user = userOf(request);
    const { mediaType, tmdbId } = paramsSchema.parse(request.params);
    // Aimé avant son arrivée : rien à défaire chez Jellyfin.
    if (await dropOffLibraryLike(user.userId, mediaType, tmdbId)) {
      pokeProfile(user.userId);
      return { state: "none" as const };
    }
    const lookup = await findLibraryItemByTmdb(tmdbId, mediaType);
    if (lookup.kind === "found") {
      if (!(await unfavoriteItemForUser(user.userId, lookup.id))) throw new Error("Jellyfin n'a pas retiré le cœur");
      favoritesChanged(user.userId, mediaType, tmdbId, false);
    }
    return { state: "none" as const };
  });
};
