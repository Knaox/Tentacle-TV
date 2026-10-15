import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { requireSessionAnyAccess, type JellyfinUser } from "../middleware/auth";
import { accountAccessFor } from "../services/accountAccess/accountAccessState";
import type { AccountAccessBlocked, AccountAccessState } from "../accountAccess/accountAccessContract";

/**
 * `GET /api/account/access` — l'état d'accès du compte de la session
 * (docs/DROITS-UTILISATEURS.md § 9.1). La SEULE route qu'un compte bloqué lit
 * encore, avec la déconnexion et le déjumelage : les clients en tirent leur
 * page « compte désactivé / hors plage », et la relisent à la réouverture.
 */
export const accountAccessRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/access",
    { preHandler: [requireSessionAnyAccess], config: { rateLimit: { max: 60, timeWindow: 60_000 } } },
    async (request, reply): Promise<AccountAccessState> => {
      // Jamais servie d'un cache : c'est l'état à l'instant.
      reply.header("Cache-Control", "private, no-store");
      const session = request as FastifyRequest & { user?: JellyfinUser; accountAccessBlocked?: AccountAccessBlocked };
      if (session.accountAccessBlocked) return session.accountAccessBlocked;
      const user = session.user;
      // « Voir en tant que » : l'administrateur regarde, il n'est pas borné.
      if (!user || user.session === "impersonation") return { state: "allowed" };
      return accountAccessFor(user.userId);
    },
  );
};
