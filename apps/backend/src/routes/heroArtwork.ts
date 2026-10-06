import type { FastifyInstance } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { heroArtworkFor } from "../services/heroArtwork/heroArtwork";

/** Un id Jellyfin : 32 hexadécimaux, tirets admis. */
const ITEM_ID = /^[0-9a-fA-F-]{32,36}$/;

/**
 * GET /api/hero/artwork/:itemId — les images de REPLI de la bannière
 * d'accueil : le fond TMDB, puis toutes les images Jellyfin du titre et de sa
 * série. Demandé par un client seulement quand les images annoncées d'un
 * titre manquent ou échouent : jamais une requête par titre affiché.
 */
export async function heroArtworkRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/artwork/:itemId", async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    if (!ITEM_ID.test(itemId)) return reply.status(400).send({ error: "invalid_item" });
    const user = (request as unknown as { user: JellyfinUser }).user;
    const images = await heroArtworkFor(user.userId, itemId);
    if (!images) return reply.status(404).send({ error: "not_found" });
    return { images };
  });
}
