import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { getProfileDebug, rebuildProfile } from "../services/reco/profileBuilder";
import { generatePool, readPool } from "../services/reco/generationJob";
import { idfLoadedAt } from "../services/reco/idfStore";
import { tmdbConfigured } from "../services/tmdb/client";

/**
 * Recommandations — squelette Phase 2 : inspection et reconstruction du profil
 * de goût. Les rangées arrivent en Phase 5 dans ce même périmètre /api/reco.
 */
export const recoRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // ── GET /profile/debug — le profil du compte, lisible : moyennes, top
  //    facettes. C'est l'outil de vérification du moteur, pas une UI. ──
  app.get("/profile/debug", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const profile = await getProfileDebug(user.userId);
    return {
      ...profile,
      engine: {
        tmdbConfigured: tmdbConfigured(),
        idfLoadedAt: idfLoadedAt() ? new Date(idfLoadedAt()).toISOString() : null,
      },
    };
  });

  // ── POST /profile/rebuild — reconstruction immédiate (synchrone) ──
  app.post("/profile/rebuild", async (request) => {
    const user = (request as any).user as JellyfinUser;
    return rebuildProfile(user.userId);
  });

  // ── POST /pool/generate — génération immédiate du pool (synchrone, debug) ──
  app.post("/pool/generate", async (request) => {
    const user = (request as any).user as JellyfinUser;
    return generatePool(user.userId);
  });

  // ── GET /pool/debug — résumé lisible du pool en cache ──
  app.get("/pool/debug", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const pool = await readPool(user.userId);
    if (!pool) return { exists: false };
    return {
      exists: true,
      generatedAt: pool.generatedAt,
      strategyId: pool.strategyId,
      poolSize: pool.poolSize,
      seeds: pool.seeds.map((s) => ({ key: `${s.mediaType}:${s.tmdbId}`, title: s.title, strength: s.strength })),
      bySource: pool.entries.reduce<Record<string, number>>((acc, e) => {
        acc[e.candidate.source] = (acc[e.candidate.source] ?? 0) + 1;
        return acc;
      }, {}),
      top: pool.entries.slice(0, 15).map((e) => ({
        key: e.candidate.key,
        title: e.candidate.title,
        source: e.candidate.source,
        inLibrary: !!e.candidate.jellyfinItemId,
        total: e.breakdown.total,
        similarity: e.breakdown.similarity,
        contributors: e.breakdown.topContributors.slice(0, 3),
      })),
    };
  });
};
