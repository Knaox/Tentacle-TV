/* ------------------------------------------------------------------ */
/*  L'aperçu de bande-annonce au survol d'une carte                     */
/*                                                                     */
/*  GET /api/trailers/preview?itemId=…&lang=fr                         */
/*  GET /api/trailers/preview?tmdbId=…&mediaType=movie|tv&lang=fr      */
/*                                                                     */
/*  UN appel du client ; le serveur choisit la bande-annonce, la       */
/*  vérifie et rend le flux qu'il relaie — ou un refus, et rien ne     */
/*  s'anime (contrat : packages/shared/src/trailers/trailerPreview.ts, */
/*  recopié dans src/trailers/). Tout compte connecté y a droit, une   */
/*  session de profil ou d'invité aussi : c'est regarder.              */
/* ------------------------------------------------------------------ */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { relayedStream } from "../services/trailers/relayPaths";
import { decidePreview } from "../services/trailers/preview/previewDecision";
import { resolvePreviewTitle } from "../services/trailers/preview/previewTitle";
import {
  parseTrailerPreviewQuery, type TrailerPreview, type TrailerPreviewRefusal, type TrailerPreviewRefusalBody,
} from "../trailers/trailerPreview";

function refuse(reply: FastifyReply, status: 400 | 404 | 429, error: TrailerPreviewRefusal) {
  const body: TrailerPreviewRefusalBody = { error };
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

    const lookup = await resolvePreviewTitle(query, userId);
    if (lookup.kind === "none") return refuse(reply, 404, "no_trailer");
    if (lookup.kind === "error") return refuse(reply, 404, "unavailable");

    const outcome = await decidePreview(lookup.title, query.lang, userId);
    if (outcome.kind === "limited") {
      reply.header("Retry-After", String(outcome.retryAfterS));
      return refuse(reply, 429, "rate_limited");
    }
    if (outcome.kind === "refused") return refuse(reply, 404, outcome.error);

    const stream = relayedStream(outcome.ytId, outcome.resolved);
    const preview: TrailerPreview = {
      ytId: outcome.ytId,
      path: stream.path,
      mimeType: stream.mimeType,
      expiresAt: stream.expiresAt,
      heights: outcome.resolved.heights,
      qualities: stream.qualities,
    };
    return preview;
  });
};
