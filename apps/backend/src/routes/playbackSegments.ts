/**
 * GET /api/playback/segments/:itemId — LE résolveur de segments, côté serveur.
 *
 * Source de vérité unique du contrat v1 (`PlaybackSegmentsResponse`) : les
 * clients ne recalculent rien, le snapshot hors ligne du bureau persiste cette
 * réponse telle quelle. Les sources sont Jellyfin (API Media Segments, greffon
 * intro-skipper, chapitres) et l'analyse de fin de média de Tentacle, qui ne
 * lit que les vignettes trickplay que Jellyfin sert. Aucune API tierce, et
 * aucune écoute : l'analyse audio est retirée.
 *
 * Jellyfin injoignable → 200 avec `segments: []` : un lecteur privé de
 * segments doit lire quand même, jamais échouer.
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { resolvePlaybackSegments } from "../playback/resolveSegments";
import { requireAuth } from "../middleware/auth";
import { getJellyfinApiKey, getJellyfinUrl } from "../services/configStore";
import { getSegmentSourceBundle } from "../services/jellyfinSegments";
import {
  needsTailAnalysis,
  providerSpans,
  startTailAnalysis,
  tailAnalysisPending,
} from "../services/tailAnalysis/tailAnalysis";
import { readTailVerdict } from "../services/tailAnalysis/tailStore";

const ParamsSchema = z.object({
  itemId: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
});

export const playbackSegmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/segments/:itemId", async (request, reply) => {
    const { itemId } = ParamsSchema.parse(request.params);

    const bundle = await getSegmentSourceBundle(itemId);
    const resolvedAt = new Date().toISOString();
    // Le verdict déjà rendu sur ce média par l'analyse de fin de média.
    const tail = await readTailVerdict(itemId, bundle.runtimeMs);
    const response = resolvePlaybackSegments(
      itemId,
      bundle.runtimeMs,
      { ...bundle.sources, tail: tail ?? null },
      resolvedAt,
      bundle.libraryId,
    );

    // La fin de média s'analyse pour TOUT média, une fois : les fournisseurs n'y
    // sont que des indices (voir le service). `undefined` veut dire « jamais
    // analysé, ou rien trouvé » — ce dernier cas refroidit en mémoire.
    if (needsTailAnalysis(itemId, bundle.runtimeMs, bundle.trickplay !== null, tail)) {
      const url = getJellyfinUrl();
      const apiKey = getJellyfinApiKey();
      if (url && apiKey) {
        startTailAnalysis({
          itemId,
          runtimeMs: bundle.runtimeMs,
          // La source dont la durée fait foi — sans elle, un média multi-versions
          // ferait mesurer les planches d'une autre édition (voir le bundle).
          mediaSourceId: bundle.defaultMediaSourceId,
          trickplay: bundle.trickplay,
          providerSpans: providerSpans(itemId, bundle),
          jellyfinUrl: url.replace(/\/$/, ""),
          apiKey,
        });
      }
    }
    // Le lecteur n'attend pas : il redemandera le contrat, et le générique
    // n'arrive qu'à la fin du média.
    if (tailAnalysisPending(itemId)) response.analysisPending = true;

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
