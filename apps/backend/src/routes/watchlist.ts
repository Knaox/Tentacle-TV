import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";

// Un id Jellyfin : GUID avec ou sans tirets — rien d'autre ne passe par l'URL.
const seriesIdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/);
const bodySchema = z.object({ seriesId: seriesIdSchema });
const paramsSchema = z.object({ seriesId: seriesIdSchema });

/**
 * « Ma liste » vit chez Jellyfin (Likes) ; le serveur ne porte que ce que
 * Jellyfin ne sait pas dire : quelles séries en sont sorties AUTOMATIQUEMENT
 * parce que tout le disponible était vu — pour les y remettre dès qu'un
 * épisode arrive (services/watchlistAutoRetired.ts). Le client écrit ici au
 * retrait automatique, et efface dès que l'utilisateur reprend la main.
 * Toutes les routes rendent un JSON : le client fait `res.json()` sans garde.
 */
export const watchlistRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // ── GET /auto-retired — les séries du compte qui reviendront d'elles-mêmes ──
  app.get("/auto-retired", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const rows = await getPrisma().watchlistAutoRetired.findMany({
      where: { jellyfinUserId: user.userId },
      orderBy: { retiredAt: "desc" },
      select: { seriesId: true },
    });
    return rows.map((r) => r.seriesId);
  });

  // ── PUT /auto-retired — mémorise un retrait automatique (idempotent) ──
  app.put("/auto-retired", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const body = bodySchema.parse(request.body);
    await getPrisma().watchlistAutoRetired.upsert({
      where: { seriesId_jellyfinUserId: { seriesId: body.seriesId, jellyfinUserId: user.userId } },
      create: { seriesId: body.seriesId, jellyfinUserId: user.userId },
      update: {},
    });
    return { ok: true };
  });

  // ── DELETE /auto-retired/:seriesId — l'utilisateur a repris la main (idempotent) ──
  app.delete("/auto-retired/:seriesId", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const params = paramsSchema.parse(request.params);
    await getPrisma().watchlistAutoRetired.deleteMany({
      where: { seriesId: params.seriesId, jellyfinUserId: user.userId },
    });
    return { ok: true };
  });
};
