/**
 * Octave — les LIENS partagés (capacité `music.sharedLinks`) :
 * - `GET /api/music/links/track?url=<lien Shazam>` (sous `/api/music`, session et accès à Octave exigés) : le
 *   titre et l'artiste du lien, que la recherche pose (`SharedTrackQuery`) ; refus en liste fermée.
 * - `GET /octave/open/<page>` (sans compte) : la page d'ouverture d'un lien (`openPage.ts`).
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { capabilityGate } from "../../serverCapabilities/declaredCapabilities";
import { resolveShazamLink } from "./shazamResolve";
import { sendOctaveOpenPage } from "./openPage";

const gate = capabilityGate("music.sharedLinks");

export function musicSharedLinkRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { url?: string } }>(
    "/links/track",
    { onRequest: gate, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      reply.header("cache-control", "private, no-store");
      const url = (request.query.url ?? "").slice(0, 2_048);
      const result = await resolveShazamLink(url);
      if ("refusal" in result) {
        const status = result.refusal === "unsupported" ? 400 : result.refusal === "not_found" ? 404 : 502;
        return reply.status(status).send({ error: result.refusal });
      }
      return result;
    },
  );
}

export const musicOpenPublicRoutes: FastifyPluginAsync = async (app) => {
  app.get("/octave/open/*", { onRequest: gate, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) =>
    sendOctaveOpenPage(request, reply),
  );
};
