/* ------------------------------------------------------------------ */
/*  Le catalogue des bandes-annonces d'un titre                         */
/*                                                                     */
/*  GET /api/trailers/catalog?itemId=…[&lang=fr]                       */
/*  GET /api/trailers/catalog?tmdbId=…&mediaType=movie|tv[&season=N]   */
/*                                                                     */
/*  La liste ORDONNÉE par le serveur (contrat : packages/shared/src/   */
/*  trailers/trailerCatalog.ts, recopié dans src/trailers/) : la       */
/*  saison d'abord, la langue du serveur d'abord. Tout compte connecté */
/*  y a droit, une session de profil ou d'invité aussi : c'est         */
/*  regarder. Un seau par compte : 30 d'avance, puis une par seconde.  */
/* ------------------------------------------------------------------ */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { buildCatalog } from "../services/trailers/catalog/catalogBuild";
import { TokenBuckets } from "../services/trailers/sourceGuard";
import { parseTrailerCatalogQuery, type TrailerCatalogRefusal } from "../trailers/trailerCatalog";

const limiter = new TokenBuckets(30, 1_000);

function refuse(reply: FastifyReply, status: 400 | 429, error: TrailerCatalogRefusal) {
  return reply.status(status).send({ error });
}

export const trailerCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/catalog", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseTrailerCatalogQuery(request.query as Record<string, unknown>);
    if (!query) return refuse(reply, 400, "invalid_request");
    const { userId } = (request as FastifyRequest & { user: JellyfinUser }).user;
    const wait = limiter.take(userId);
    if (wait > 0) {
      reply.header("Retry-After", String(Math.ceil(wait / 1000)));
      return refuse(reply, 429, "rate_limited");
    }
    const catalog = await buildCatalog(query, userId);
    // Une liste de quelques Ko, propre au compte (ce qu'il voit) : son navigateur la garde une minute.
    reply.header("Cache-Control", "private, max-age=60");
    return catalog;
  });
};

/** Pour les tests. */
export function resetCatalogLimiter(): void {
  limiter.reset();
}
