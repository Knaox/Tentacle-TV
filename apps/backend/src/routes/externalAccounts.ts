import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { tmdbConfigured } from "../services/tmdb/client";
import { ensureGuestSession } from "../services/tmdb/guestSession";
import {
  anilistAvailable,
  buildAuthorizeUrl,
  completeOAuth,
  consumeOAuthState,
  createOAuthState,
} from "../services/anilist/oauth";
import { getPublicUrl } from "../services/configStore";

// TheTVDB : PAS d'intégration, et ce n'est pas un oubli. L'API v4 expose
// Favorites, Lists et User Info mais AUCUN endpoint d'écriture de note —
// vérifié sur la doc v4 complète. Ne pas rechercher un moyen détourné dans
// six mois : il n'y en a pas.

/**
 * Comptes externes : guest session TMDB (notes anonymes) et OAuth AniList.
 * Le callback OAuth est PUBLIC (le `state` à usage unique authentifie le
 * retour) ; tout le reste exige la session Tentacle.
 */
export const externalAccountRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /anilist/callback — retour OAuth (public, authentifié par state) ──
  app.get("/anilist/callback", async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    const base = getPublicUrl() ?? "";
    const target = (status: string) => `${base}/settings/personalization?anilist=${status}`;
    if (!code || !state) return reply.redirect(target("error"));
    const userId = consumeOAuthState(state);
    if (!userId) return reply.redirect(target("expired"));
    try {
      await completeOAuth(userId, code);
      return reply.redirect(target("linked"));
    } catch {
      return reply.redirect(target("error"));
    }
  });

  // ── Tout le reste : session Tentacle obligatoire ──
  app.register(async (authed) => {
    authed.addHook("preHandler", requireAuth);

    // ── GET /accounts — l'état des deux liaisons + la santé de la sync ──
    authed.get("/accounts", async (request) => {
      const user = (request as any).user as JellyfinUser;
      const prisma = getPrisma();
      const [accounts, statuses] = await Promise.all([
        prisma.externalAccount.findMany({ where: { jellyfinUserId: user.userId } }),
        prisma.userRating.groupBy({
          by: ["syncStatus"],
          where: { jellyfinUserId: user.userId },
          _count: { _all: true },
        }),
      ]);
      const guest = accounts.find((a) => a.provider === "tmdb_guest");
      const anilist = accounts.find((a) => a.provider === "anilist");
      const counts: Record<string, number> = {};
      for (const s of statuses) counts[s.syncStatus] = s._count._all;
      return {
        tmdb: {
          configured: tmdbConfigured(),
          linked: !!guest?.guestSessionId,
          linkedAt: guest?.createdAt.toISOString() ?? null,
        },
        anilist: {
          available: anilistAvailable(),
          linked: !!anilist?.accessToken,
          externalId: anilist?.externalId ?? null,
          linkedAt: anilist?.createdAt.toISOString() ?? null,
        },
        sync: {
          pending: (counts.pending ?? 0) + (counts.delete_pending ?? 0),
          failed: counts.failed ?? 0,
          synced: counts.synced ?? 0,
        },
      };
    });

    // ── POST /tmdb/guest-session — crée (ou confirme) la session anonyme ──
    authed.post("/tmdb/guest-session", async (request, reply) => {
      const user = (request as any).user as JellyfinUser;
      if (!tmdbConfigured()) {
        return reply.status(503).send({ message: "TMDB non configuré sur ce serveur" });
      }
      const guestSessionId = await ensureGuestSession(user.userId);
      return { guestSessionId };
    });

    // ── DELETE /tmdb/guest-session — délie (les notes locales restent) ──
    authed.delete("/tmdb/guest-session", async (request) => {
      const user = (request as any).user as JellyfinUser;
      const prisma = getPrisma();
      await prisma.externalAccount.deleteMany({
        where: { jellyfinUserId: user.userId, provider: "tmdb_guest" },
      });
      return { ok: true };
    });

    // ── POST /anilist/authorize-url — l'URL de consentement, state lié au
    //    compte (la navigation du navigateur ne porte pas le Bearer desktop). ──
    authed.post("/anilist/authorize-url", async (request, reply) => {
      const user = (request as any).user as JellyfinUser;
      if (!anilistAvailable()) {
        return reply.status(503).send({ message: "AniList non configuré sur ce serveur" });
      }
      const url = buildAuthorizeUrl(createOAuthState(user.userId));
      if (!url) return reply.status(503).send({ message: "AniList non configuré sur ce serveur" });
      return { url };
    });

    // ── DELETE /anilist — délie le compte (jeton chiffré effacé) ──
    authed.delete("/anilist", async (request) => {
      const user = (request as any).user as JellyfinUser;
      const prisma = getPrisma();
      await prisma.externalAccount.deleteMany({
        where: { jellyfinUserId: user.userId, provider: "anilist" },
      });
      return { ok: true };
    });

    // ── POST /resync — rejoue les échecs et réévalue les « disabled ».
    //    `deletedAt` fait foi sur l'intention : une SUPPRESSION en échec
    //    repart en delete_pending, jamais en poussée. ──
    authed.post("/resync", async (request) => {
      const user = (request as any).user as JellyfinUser;
      const prisma = getPrisma();
      const [pushes, deletes] = await prisma.$transaction([
        prisma.userRating.updateMany({
          where: {
            jellyfinUserId: user.userId,
            syncStatus: { in: ["failed", "disabled"] },
            deletedAt: null,
          },
          data: { syncStatus: "pending", syncAttempts: 0, nextSyncAt: new Date() },
        }),
        prisma.userRating.updateMany({
          where: {
            jellyfinUserId: user.userId,
            syncStatus: "failed",
            deletedAt: { not: null },
          },
          data: { syncStatus: "delete_pending", syncAttempts: 0, nextSyncAt: new Date() },
        }),
      ]);
      return { requeued: pushes.count + deletes.count };
    });
  });
};
