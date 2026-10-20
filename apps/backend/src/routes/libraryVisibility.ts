/**
 * POST /api/library/visibility — les titres gardés sur l'appareil, jugés pour
 * l'identité en session (capacité `offline.verdicts`). Ouvert aux sessions de
 * profil : c'est justement le profil d'un enfant, ouvert sur le téléphone du
 * parent, qui ne doit pas lire ce que le parent a gardé pour lui.
 */

import type { FastifyPluginAsync } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { libraryVisibilityFor } from "../services/itemAccess/libraryVisibility";
import { parseLibraryVisibilityBody } from "../libraryVisibility/libraryVisibilityContract";

export const libraryVisibilityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.post("/visibility", async (request, reply) => {
    const user = (request as unknown as { user: JellyfinUser }).user;
    const body = parseLibraryVisibilityBody(request.body);
    if (!body) return reply.status(400).send({ error: "invalid_input" });
    reply.header("cache-control", "private, no-store");
    return libraryVisibilityFor(user.userId, body.itemIds);
  });
};
