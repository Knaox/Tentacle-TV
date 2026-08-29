import type { FastifyPluginAsync } from "fastify";
import { getPrisma, hasPrisma } from "../services/db";
import { collectorState } from "../services/watchTime/collector";

/**
 * Diagnostic du collecteur de temps — enregistré depuis adminRoutes, donc
 * derrière `requireAdmin`.
 *
 * C'est l'outil de vérification n°1 : il montre l'état VIVANT du collecteur,
 * sans passer par le cache de cinq minutes du classement. Sans lui, régler la
 * mesure au chronomètre serait impossible — on attendrait cinq minutes pour
 * voir l'effet de chaque essai.
 */
export const adminWatchTimeRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/watch-time — état du collecteur + totaux du jour. */
  app.get("/watch-time", async () => {
    const collector = collectorState();
    if (!hasPrisma()) return { collecteur: collector, aujourdhui: [], derniers: [] };

    const prisma = getPrisma();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [perUser, latest] = await Promise.all([
      prisma.watchSegment.groupBy({
        by: ["jellyfinUserId"],
        where: { startedAt: { gte: dayStart } },
        _sum: { seconds: true },
        _count: { _all: true },
      }),
      prisma.watchSegment.findMany({
        orderBy: { lastSeenAt: "desc" },
        take: 10,
        select: {
          jellyfinUserId: true,
          itemName: true,
          itemType: true,
          seconds: true,
          runtimeSeconds: true,
          clientName: true,
          startedAt: true,
          lastSeenAt: true,
          closedAt: true,
        },
      }),
    ]);

    // Les clés de cette réponse sont le contrat de la route : elles restent en
    // français, comme celles de `CollectorState`.
    return {
      collecteur: collector,
      aujourdhui: perUser.map((u) => ({
        userId: u.jellyfinUserId,
        segments: u._count._all,
        secondes: u._sum.seconds ?? 0,
      })),
      derniers: latest,
    };
  });
};
