import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { requirePersonalAdmin, type JellyfinUser } from "../middleware/auth";
import { USER_RIGHTS_REFUSAL_STATUS, type UserRightsRefusalBody } from "../userRights/userRightsContract";
import { USER_RIGHTS_ROUTES } from "../userRights/userRightsRoutes";
import { readUserRights, updateUserRights } from "../services/userRights/userRightsService";
import { getUserRightsOptions } from "../services/userRights/userRightsOptions";
import { UserRightsFailure } from "../services/userRights/userRightsFailure";

/**
 * Les droits d'un compte (docs/DROITS-UTILISATEURS.md § 3) — `USER_RIGHTS_ROUTES`.
 * Enregistré depuis `adminRoutes` (derrière `requireAdmin`), puis gardé par
 * `requirePersonalAdmin` : jamais une TV jumelée, une session de profil ni
 * « voir en tant que ». Un refus rend `{ error }` (liste fermée), jamais un
 * message de Jellyfin.
 */

const PREFIX = "/api/admin";

function local(path: string): string {
  return path.slice(PREFIX.length);
}

function send(reply: FastifyReply, error: unknown) {
  if (error instanceof UserRightsFailure) {
    const body: UserRightsRefusalBody = { error: error.code, ...(error.fields?.length ? { fields: error.fields } : {}) };
    return reply.status(USER_RIGHTS_REFUSAL_STATUS[error.code]).send(body);
  }
  throw error;
}

function actorOf(request: FastifyRequest): { userId: string; username: string } {
  const user = (request as FastifyRequest & { user?: JellyfinUser }).user;
  return { userId: user?.userId ?? "", username: user?.username ?? "?" };
}

function userIdParam(request: FastifyRequest): unknown {
  return (request.params as Record<string, unknown> | undefined)?.userId;
}

export const adminUserRightsRoutes: FastifyPluginAsync = async (app) => {
  const { options, read, update } = USER_RIGHTS_ROUTES;

  app.get(local(options.path), { preHandler: requirePersonalAdmin }, async (_request, reply) => {
    try {
      return await getUserRightsOptions();
    } catch (error) {
      return send(reply, error);
    }
  });

  app.get(local(read.path), { preHandler: requirePersonalAdmin }, async (request, reply) => {
    try {
      return await readUserRights(userIdParam(request));
    } catch (error) {
      return send(reply, error);
    }
  });

  app.patch(
    local(update.path),
    {
      preHandler: requirePersonalAdmin,
      bodyLimit: 256 * 1024,
      config: { rateLimit: { max: update.rateLimit.max, timeWindow: update.rateLimit.windowMs } },
    },
    async (request, reply) => {
      try {
        return await updateUserRights(actorOf(request), userIdParam(request), request.body);
      } catch (error) {
        return send(reply, error);
      }
    },
  );
};
