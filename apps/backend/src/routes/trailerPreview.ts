/* ------------------------------------------------------------------ */
/*  L'aperçu de bande-annonce au survol d'une carte                     */
/*                                                                     */
/*  GET /api/trailers/preview?itemId=…&lang=fr                         */
/*  GET /api/trailers/preview?tmdbId=…&mediaType=movie|tv&lang=fr      */
/*                                                                     */
/*  La langue qui classe les bandes-annonces est celle du SERVEUR      */
/*  (`previewLanguage.ts`) ; `lang` ne vaut qu'à défaut.               */
/*                                                                     */
/*  UN appel du client ; le serveur choisit la bande-annonce, la       */
/*  vérifie et rend le flux qu'il relaie — ou un refus, et rien ne     */
/*  s'anime (contrat : packages/shared/src/trailers/trailerPreview.ts, */
/*  recopié dans src/trailers/). Tout compte connecté y a droit, une   */
/*  session de profil ou d'invité aussi : c'est regarder.              */
/* ------------------------------------------------------------------ */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { resolveCatalogTitle } from "../services/trailers/catalog/catalogTitle";
import { previewBody } from "../services/trailers/preview/previewBody";
import { decidePreview, type PreviewTarget } from "../services/trailers/preview/previewDecision";
import { previewLanguage } from "../services/trailers/preview/previewLanguage";
import {
  type TrailerPreviewRequest, parseTrailerPreviewQuery, type TrailerPreviewRefusal, type TrailerPreviewRefusalBody,
} from "../trailers/trailerPreview";

/**
 * La clé de décision et la demande de CATALOGUE d'un aperçu : un titre de la
 * bibliothèque — film, série, saison ou épisode (sa saison d'abord) — est lu
 * au nom du compte par le catalogue (ce qu'il ne voit pas : rien) ; un titre
 * TMDB s'en passe.
 */
export function previewTarget(request: TrailerPreviewRequest, lang: string | undefined): PreviewTarget {
  const withLang = lang ? { lang } : {};
  if ("itemId" in request) return { key: `jf:${request.itemId}`, catalog: { itemId: request.itemId, ...withLang } };
  return { key: `tmdb:${request.mediaType}:${request.tmdbId}`, catalog: { tmdbId: request.tmdbId, mediaType: request.mediaType, ...withLang } };
}

function refuse(reply: FastifyReply, status: 400 | 404 | 429, error: TrailerPreviewRefusal, retryAfterS?: number) {
  const body: TrailerPreviewRefusalBody = retryAfterS === undefined ? { error } : { error, retryAfterS };
  return reply.status(status).send(body);
}

export const trailerPreviewRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/preview", async (request: FastifyRequest, reply: FastifyReply) => {
    // Un jeton d'accès voyage dans la réponse : aucun cache intermédiaire ne la garde.
    reply.header("Cache-Control", "private, no-store");
    const query = parseTrailerPreviewQuery(request.query as Record<string, unknown>);
    if (!query) return refuse(reply, 400, "invalid_request");
    const { userId } = (request as FastifyRequest & { user: JellyfinUser }).user;

    // Un titre de la bibliothèque, vu par CE compte (lecture gardée deux minutes, que le catalogue
    // reprend) : la décision, partagée par tous ceux qui le voient, n'est jamais prise pour un autre.
    if ("itemId" in query) {
      const lookup = await resolveCatalogTitle(query.itemId, userId);
      if (lookup.kind === "none") return refuse(reply, 404, "no_trailer");
      if (lookup.kind === "error") return refuse(reply, 404, "unavailable");
    }
    // La langue du serveur (métadonnées de Jellyfin), celle du client à défaut.
    const lang = await previewLanguage(query.lang);
    const outcome = await decidePreview(previewTarget(query, lang), lang, userId, { dailymotion: query.dailymotion === true });
    if (outcome.kind === "limited") {
      // L'en-tête (exposé au CORS) et le corps disent la même chose : un client lit l'un ou l'autre.
      reply.header("Retry-After", String(outcome.retryAfterS));
      return refuse(reply, 429, "rate_limited", outcome.retryAfterS);
    }
    if (outcome.kind === "refused") return refuse(reply, 404, outcome.error);
    return previewBody(outcome.ref, outcome.resolved, outcome.version);
  });
};
