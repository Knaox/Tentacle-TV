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
import {
  audioAnalysisPending,
  audioNeeds,
  enqueueAudioAnalysis,
  needsAudioAnalysis,
  readStoredAudioVerdict,
} from "../services/audioAnalysis";

const ParamsSchema = z.object({
  itemId: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/),
});

export const playbackSegmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/segments/:itemId", async (request, reply) => {
    const { itemId } = ParamsSchema.parse(request.params);

    const bundle = await getSegmentSourceBundle(itemId);
    const resolvedAt = new Date().toISOString();
    // Les verdicts déjà rendus sur ce média : les vignettes, l'audio des voisins.
    const [frames, audio] = await Promise.all([
      readFrameVerdict(itemId, bundle.runtimeMs),
      readStoredAudioVerdict(itemId, bundle.runtimeMs),
    ]);
    const response = resolvePlaybackSegments(
      itemId,
      bundle.runtimeMs,
      { ...bundle.sources, frames: frames ?? null, audio: audio?.verdict ?? null },
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
          // La source dont la durée fait foi — sans elle, un média multi-versions
          // ferait mesurer les planches d'une autre édition (voir le bundle).
          ...(bundle.defaultMediaSourceId !== null
            ? { mediaSourceId: bundle.defaultMediaSourceId }
            : {}),
          jellyfinUrl: url.replace(/\/$/, ""),
          apiKey,
        });
      }
    }
    // L'audio des voisins de saison, pour un épisode qu'aucun fournisseur n'a
    // entièrement décrit — file à un slot, jamais attendue (voir le service).
    if (bundle.episode !== null && needsAudioAnalysis(response, bundle, audio)) {
      const url = getJellyfinUrl();
      const apiKey = getJellyfinApiKey();
      if (url && apiKey) {
        enqueueAudioAnalysis({
          itemId,
          runtimeMs: bundle.runtimeMs,
          mediaSourceId: bundle.defaultMediaSourceId,
          episode: bundle.episode,
          need: audioNeeds(response),
          pluginInstalled: bundle.sources.pluginDict != null,
          previousNeighbourKey: audio?.verdict.neighbourKey ?? null,
          jellyfinUrl: url.replace(/\/$/, ""),
          apiKey,
        });
      }
    }
    // Le lecteur n'attend pas : il redemandera le contrat, et le générique
    // n'arrive qu'à la fin du média.
    if (frameAnalysisRunning(itemId) || audioAnalysisPending(itemId)) response.analysisPending = true;

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
