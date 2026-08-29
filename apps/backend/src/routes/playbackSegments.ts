/**
 * GET /api/playback/segments/:itemId — LE résolveur de segments, côté serveur.
 *
 * Source de vérité unique du contrat v1 (`PlaybackSegmentsResponse`) : les
 * clients ne recalculent rien, le snapshot hors ligne du bureau persiste cette
 * réponse telle quelle. Strictement Jellyfin : API Media Segments, greffon
 * intro-skipper, chapitres — aucune API tierce, aucun repli statistique.
 *
 * Jellyfin injoignable → 200 avec `segments: []` : un lecteur privé de
 * segments doit lire quand même, jamais échouer.
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { resolvePlaybackSegments } from "../playback/resolveSegments";
import { requireAuth } from "../middleware/auth";
import { getSegmentSourceBundle } from "../services/jellyfinSegments";

const ParamsSchema = z.object({
  itemId: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
});

export const playbackSegmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/segments/:itemId", async (request, reply) => {
    const { itemId } = ParamsSchema.parse(request.params);

    const bundle = await getSegmentSourceBundle(itemId);
    const response = resolvePlaybackSegments(
      itemId,
      bundle.runtimeMs,
      bundle.sources,
      new Date().toISOString(),
      bundle.libraryId,
    );

    // Court : aligné sur le TTL du cache serveur — un segment fraîchement
    // détecté par un scan est visible en ~1 min sans marteler le backend.
    reply.header("cache-control", "private, max-age=60");
    return response;
  });
};
