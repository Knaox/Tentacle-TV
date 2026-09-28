import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import type { SagaResponse } from "../saga/sagaTypes";
import { sagaMembersFor } from "../services/search/sagaMembers";
import { getSagaCollection } from "../services/tmdb/sagaCollection";

/**
 * `GET /api/sagas/:collectionId?lang=fr` — la saga TMDB d'un film et les
 * titres de la bibliothèque qui en font partie, pour le compte connecté.
 *
 * - `members` : les films que CE compte peut voir (l'index de recherche les
 *   connaît, `sagaMembers.ts`) ; le client les relit chez Jellyfin par leurs
 *   identifiants, avec son état « vu » à jour ;
 * - `saga` : nom et volets selon TMDB (`sagaCollection.ts`), null sans clé
 *   TMDB — demandée seulement si la bibliothèque a au moins un film de la
 *   saga : un identifiant quelconque ne coûte pas un appel TMDB.
 *
 * 503 tant que l'index ou les droits du compte ne sont pas relevés (le
 * démarrage du serveur) : le client réessaie, il ne conclut pas à une saga
 * vide. Réponse privée, jamais mise en cache par un intermédiaire.
 */

const PARAMS = z.object({ collectionId: z.coerce.number().int().min(1).max(2_147_483_647) });
const QUERY = z.object({ lang: z.enum(["fr", "en"]).catch("fr") });

export const sagaRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/:collectionId", async (request, reply) => {
    const params = PARAMS.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "invalid-collection" });
    const { lang } = QUERY.parse(request.query ?? {});
    const { collectionId } = params.data;
    const user = (request as unknown as { user: JellyfinUser }).user;

    const found = await sagaMembersFor(user.userId, collectionId);
    if (!found.ready) {
      return reply.status(503).header("Retry-After", "10").send({ error: "index-not-ready" });
    }
    const saga = found.members.length > 0 ? await getSagaCollection(collectionId, lang) : null;
    const body: SagaResponse = { collectionId, saga, members: found.members };
    return reply.header("Cache-Control", "private, no-store").send(body);
  });
};
