import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { tmdbConfigured } from "../services/tmdb/client";
import { ensureGuestSession } from "../services/tmdb/guestSession";

// TheTVDB : PAS d'intégration, et ce n'est pas un oubli. L'API v4 expose
// Favorites, Lists et User Info mais AUCUN endpoint d'écriture de note —
// vérifié sur la doc v4 complète. Ne pas rechercher un moyen détourné dans
// six mois : il n'y en a pas.

/**
 * Comptes externes : guest session TMDB (notes anonymes) et santé de la file
 * de sync. Tout exige la session Tentacle.
 */
export const externalAccountRoutes: FastifyPluginAsync = async (app) => {
  app.register(async (authed) => {
    authed.addHook("preHandler", requireAuth);

    // ── GET /accounts — l'état de la liaison TMDB + la santé de la sync ──
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
      const counts: Record<string, number> = {};
      for (const s of statuses) counts[s.syncStatus] = s._count._all;
      return {
        tmdb: {
          configured: tmdbConfigured(),
          linked: !!guest?.guestSessionId,
          linkedAt: guest?.createdAt.toISOString() ?? null,
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
