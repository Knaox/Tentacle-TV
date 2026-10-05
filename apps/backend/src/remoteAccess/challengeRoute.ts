import type { FastifyPluginAsync } from "fastify";
import { CHALLENGE_PATH_PREFIX, CHALLENGE_PATTERN } from "./checkProtocol";
import { readChallenge } from "./challengeStore";

/**
 * GET /.well-known/tentacle-check/:id — public (le service de test la lit
 * depuis Internet), mais muet : un défi inconnu, expiré ou épuisé répond 404,
 * exactement comme une adresse qui n'existe pas. Débit borné.
 */
export const challengeRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    `${CHALLENGE_PATH_PREFIX}:id`,
    { config: { rateLimit: { max: 30, timeWindow: 60_000 } } },
    async (request, reply) => {
      const id = request.params.id;
      const token = CHALLENGE_PATTERN.test(id) ? readChallenge(id) : null;
      if (!token) return reply.code(404).header("cache-control", "no-store").send({ message: "Not Found" });
      return reply.header("cache-control", "no-store").type("text/plain; charset=utf-8").send(token);
    },
  );
};
