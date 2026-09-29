import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../middleware/auth";
import { readTrailerReadiness } from "../services/jellyfinSetup/trailerReadiness";

/**
 * GET /api/trailers/readiness — le diagnostic des bandes-annonces résumé pour
 * tout compte connecté : prêt, mal réglé (et pourquoi), inconnu. Une fiche
 * sans bande-annonce s'en sert pour renvoyer au guide quand le serveur est
 * mal réglé, sans rien savoir de ses bibliothèques. Contrat :
 * `TrailerReadiness` (packages/shared/src/jellyfinCompat/setupContract.ts).
 */
export const trailerReadinessRoutes: FastifyPluginAsync = async (app) => {
  app.get("/readiness", { preHandler: requireAuth }, async (_request, reply) => {
    // Le serveur le garde dix minutes : le client peut en garder une.
    reply.header("Cache-Control", "private, max-age=60");
    return readTrailerReadiness();
  });
};
