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
import { getJellyfinApiKey, getJellyfinUrl } from "../services/configStore";
import {
  frameAnalysisRunning,
  needsFrameAnalysis,
  readFrameVerdict,
  startFrameAnalysis,
} from "../services/frameAnalysis";
import { getSegmentSourceBundle } from "../services/jellyfinSegments";

const ParamsSchema = z.object({
  itemId: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
});

export const playbackSegmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/segments/:itemId", async (request, reply) => {
    const { itemId } = ParamsSchema.parse(request.params);

    const bundle = await getSegmentSourceBundle(itemId);
    const resolvedAt = new Date().toISOString();
    // Le verdict des vignettes, quand ce média en a déjà un.
    const frames = await readFrameVerdict(itemId, bundle.runtimeMs);
    const response = resolvePlaybackSegments(
      itemId,
      bundle.runtimeMs,
      { ...bundle.sources, frames: frames ?? null },
      resolvedAt,
      bundle.libraryId,
    );

    // L'analyse ne part que si les fournisseurs n'ont rien de crédible à dire, et
    // seulement une fois par média : `undefined` veut dire « jamais analysé »,
    // `null` veut dire « analysé, rien conclu » — et ce dernier ne se refait pas.
    if (frames === undefined && needsFrameAnalysis(response)) {
      const url = getJellyfinUrl();
      const apiKey = getJellyfinApiKey();
      if (url && apiKey && bundle.trickplay) {
        startFrameAnalysis({
          itemId,
          runtimeMs: bundle.runtimeMs,
          manifest: bundle.trickplay,
          jellyfinUrl: url.replace(/\/$/, ""),
          apiKey,
        });
      }
    }
    // Le lecteur n'attend pas : il redemandera le contrat, et le générique
    // n'arrive qu'à la fin du média.
    if (frameAnalysisRunning(itemId)) response.analysisPending = true;

    // Court : aligné sur le TTL du cache serveur — un segment fraîchement
    // détecté par un scan est visible en ~1 min sans marteler le backend.
    // Aucun cache tant qu'une analyse tourne : la réponse va changer.
    reply.header(
      "cache-control",
      response.analysisPending === true ? "no-store" : "private, max-age=60",
    );
    return response;
  });
};
