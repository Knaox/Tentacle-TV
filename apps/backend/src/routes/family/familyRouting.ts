import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { FAMILY_ROUTES, splitFamilyPath, type FamilyRouteName } from "../../family/familyRoutes";
import { familyGuard, type FamilyActor } from "../../services/family/familyCaller";
import { FamilyFailure, sendFamilyFailure } from "../../services/family/familyErrors";

/**
 * Pose une route de la Famille d'après la table du contrat (`FAMILY_ROUTES`) :
 * méthode, chemin, appelants permis (`familyGuard`) et borne par adresse — rien
 * n'est écrit deux fois. Un refus de la Famille rend son code ; un corps mal
 * formé, `family.invalid_input`.
 */

export type FamilyHandler = (request: FastifyRequest, actor: FamilyActor, now: number) => Promise<unknown>;

export function registerFamilyRoute(app: FastifyInstance, name: FamilyRouteName, handler: FamilyHandler): void {
  const spec = FAMILY_ROUTES[name];
  const { rest } = splitFamilyPath(spec.path);
  const rateLimit = "rateLimit" in spec ? spec.rateLimit : undefined;
  app.route({
    method: spec.method,
    url: rest,
    preHandler: [familyGuard(spec)],
    ...(rateLimit && { config: { rateLimit: { max: rateLimit.max, timeWindow: rateLimit.windowMs } } }),
    handler: async (request, reply) => {
      const actor = request.familyActor;
      if (!actor) return reply.status(401).send({ message: "Unauthorized" });
      try {
        return await handler(request, actor, Date.now());
      } catch (error) {
        if (error instanceof FamilyFailure) return sendFamilyFailure(reply, error);
        if (error instanceof ZodError) return sendFamilyFailure(reply, new FamilyFailure("family.invalid_input", "Requête invalide"));
        throw error;
      }
    },
  });
}

/** L'acteur réduit à ce que les services emploient. */
export function actorOf(actor: FamilyActor): { userId: string; username: string } {
  return { userId: actor.userId, username: actor.username };
}
