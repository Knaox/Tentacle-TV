import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { pokeProfile } from "../services/reco/jobs";
import { markMoviePlayedOnRating } from "../services/reco/markPlayed";

// Identité d'un titre noté : la clé canonique (mediaType, tmdbId) — celle de
// Vigie — plus saison/épisode, à 0 hors épisode (l'index unique MySQL exige du
// non-NULL pour être réel). `coerce` : la même forme sert au corps JSON et aux
// querystrings de GET/DELETE, où tout arrive en chaînes.
const identitySchema = z.object({
  mediaType: z.enum(["movie", "series", "episode"]),
  tmdbId: z.coerce.number().int().positive(),
  seasonNumber: z.coerce.number().int().min(0).default(0),
  episodeNumber: z.coerce.number().int().min(0).default(0),
});

const upsertSchema = identitySchema.extend({
  score: z.coerce.number().int().min(1).max(10),
  tvdbId: z.number().int().positive().nullish(),
  anilistId: z.number().int().positive().nullish(),
  jellyfinItemId: z.string().min(1).max(64).nullish(),
  isAnime: z.boolean().optional(),
});

/**
 * Notes explicites (1..10, 1 = une demi-étoile).
 *
 * La note est écrite en base IMMÉDIATEMENT ; la sync TMDB/AniList est un
 * travail de fond (services/reco/syncWorkers) piloté par `syncStatus` /
 * `nextSyncAt` — l'UI ne bloque jamais dessus et une note posée hors ligne
 * part à la reconnexion. Doctrine « absence ≠ 404 » : GET /item rend null.
 */
export const ratingRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // ── GET / — les notes actives du compte, récentes d'abord ──
  app.get("/", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    return prisma.userRating.findMany({
      where: { jellyfinUserId: user.userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    });
  });

  // ── GET /item — la note d'UN titre (null si absente) ──
  app.get("/item", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const q = identitySchema.parse(request.query);
    const prisma = getPrisma();
    const row = await prisma.userRating.findUnique({
      where: {
        jellyfinUserId_mediaType_tmdbId_seasonNumber_episodeNumber: {
          jellyfinUserId: user.userId,
          ...q,
        },
      },
    });
    return row && row.deletedAt === null ? row : null;
  });

  // ── PUT / — pose ou remplace une note ──
  app.put("/", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const body = upsertSchema.parse(request.body);
    const prisma = getPrisma();
    const identity = {
      jellyfinUserId: user.userId,
      mediaType: body.mediaType,
      tmdbId: body.tmdbId,
      seasonNumber: body.seasonNumber,
      episodeNumber: body.episodeNumber,
    };
    // Re-noter ressuscite une note en attente d'effacement distant (`deletedAt`
    // remis à null) : la sync repart de zéro, en « pending ».
    pokeProfile(user.userId);
    // Noter un film vaut visionnage : « vu » dans Jellyfin, en fond — l'UI
    // n'attend pas, et les séries ne sont jamais marquées (cf. markPlayed).
    void markMoviePlayedOnRating(user.userId, body.mediaType, body.tmdbId, body.jellyfinItemId).catch(
      () => undefined
    );
    return prisma.userRating.upsert({
      where: { jellyfinUserId_mediaType_tmdbId_seasonNumber_episodeNumber: identity },
      create: {
        ...identity,
        score: body.score,
        tvdbId: body.tvdbId ?? null,
        anilistId: body.anilistId ?? null,
        jellyfinItemId: body.jellyfinItemId ?? null,
        isAnime: body.isAnime ?? false,
        nextSyncAt: new Date(),
      },
      update: {
        score: body.score,
        ...(body.tvdbId != null ? { tvdbId: body.tvdbId } : {}),
        ...(body.anilistId != null ? { anilistId: body.anilistId } : {}),
        ...(body.jellyfinItemId != null ? { jellyfinItemId: body.jellyfinItemId } : {}),
        ...(body.isAnime != null ? { isAnime: body.isAnime } : {}),
        syncStatus: "pending",
        syncAttempts: 0,
        nextSyncAt: new Date(),
        deletedAt: null,
      },
    });
  });

  // ── DELETE /item — retire une note. Idempotent. ──
  // Une note déjà poussée chez TMDB ou AniList passe en `delete_pending` : le
  // worker l'efface là-bas PUIS supprime la ligne. Jamais synchronisée, elle
  // disparaît tout de suite.
  app.delete("/item", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const q = identitySchema.parse(request.query);
    const prisma = getPrisma();
    const where = {
      jellyfinUserId_mediaType_tmdbId_seasonNumber_episodeNumber: {
        jellyfinUserId: user.userId,
        ...q,
      },
    };
    const row = await prisma.userRating.findUnique({ where });
    if (!row || row.deletedAt) return { ok: true };
    pokeProfile(user.userId);
    const syncedSomewhere = row.tmdbSyncedAt !== null || row.anilistSyncedAt !== null;
    if (syncedSomewhere) {
      await prisma.userRating.update({
        where,
        data: {
          deletedAt: new Date(),
          syncStatus: "delete_pending",
          syncAttempts: 0,
          nextSyncAt: new Date(),
        },
      });
    } else {
      await prisma.userRating.delete({ where });
    }
    return { ok: true };
  });
};
