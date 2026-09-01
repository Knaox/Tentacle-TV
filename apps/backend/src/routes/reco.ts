import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { getProfileDebug, rebuildProfile } from "../services/reco/profileBuilder";
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
};
