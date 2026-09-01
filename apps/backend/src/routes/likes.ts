import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { pokeProfile } from "../services/reco/jobs";

// `coerce` : la même forme sert au corps JSON (PUT) et aux params d'URL (DELETE).
const likeSchema = z.object({
  mediaType: z.enum(["movie", "series"]),
  tmdbId: z.coerce.number().int().positive(),
});

/**
 * « J'aime » d'un titre HORS bibliothèque (catalogue Vigie).
 *
 * En bibliothèque, le like reste `IsFavorite` chez Jellyfin (via le proxy) —
 * cette table ne porte QUE ce que Jellyfin ne peut pas porter : un média
 * absent. La vue unifiée (favoris Jellyfin + likes Vigie) vit dans
 * services/reco, côté moteur.
 */
export const likeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // ── GET / — les likes hors bibliothèque du compte ──
  app.get("/", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    return prisma.userLike.findMany({
      where: { jellyfinUserId: user.userId },
      orderBy: { createdAt: "desc" },
    });
  });

  // ── PUT / — pose un like (idempotent) ──
  app.put("/", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const body = likeSchema.parse(request.body);
    const prisma = getPrisma();
    pokeProfile(user.userId);
    return prisma.userLike.upsert({
      where: {
        jellyfinUserId_mediaType_tmdbId: {
          jellyfinUserId: user.userId,
          mediaType: body.mediaType,
          tmdbId: body.tmdbId,
        },
      },
      create: { jellyfinUserId: user.userId, mediaType: body.mediaType, tmdbId: body.tmdbId },
      update: {},
    });
  });

  // ── DELETE /:mediaType/:tmdbId — retire un like (idempotent) ──
  app.delete("/:mediaType/:tmdbId", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const params = likeSchema.parse(request.params);
    const prisma = getPrisma();
    pokeProfile(user.userId);
    await prisma.userLike.deleteMany({
      where: { jellyfinUserId: user.userId, mediaType: params.mediaType, tmdbId: params.tmdbId },
    });
    return { ok: true };
  });
};
