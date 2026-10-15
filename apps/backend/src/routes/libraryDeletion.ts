import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { getTokenFromRequest, requireAuth, type JellyfinUser } from "../middleware/auth";
import {
  LIBRARY_DELETE_REFUSAL_STATUS,
  LIBRARY_DELETE_ROUTES,
  NO_LIBRARY_DELETION,
  parseLibraryDeleteRequest,
  type LibraryDeleteRefusalBody,
  type LibraryDeleteResponse,
  type LibraryDeletionRightsDto,
} from "../libraryDelete/libraryDeleteContract";
import { deleteLibraryItems, readDeletionRights, tallyOutcomes } from "../services/libraryDelete/libraryDeletion";
import { afterLibraryDeletion } from "../services/libraryDelete/afterDeletion";

/**
 * Supprimer des titres de la bibliothèque (docs/DROITS-UTILISATEURS.md § 9.7) —
 * capacité `library.delete`. Session PERSONNELLE seulement : son jeton est le
 * jeton Jellyfin du compte, celui par lequel Jellyfin juge chaque titre. Une TV
 * jumelée, une session de profil, « voir en tant que » n'ont pas de jeton
 * Jellyfin à elles (le proxy leur prête la clé d'API) : elles ne suppriment rien.
 *
 * Journal `[library-delete]` : qui, combien — jamais un titre ni un chemin.
 */

const PREFIX = "/api/library";

function local(path: string): string {
  return path.slice(PREFIX.length);
}

function personalToken(request: FastifyRequest): { user: JellyfinUser; token: string } | null {
  const user = (request as FastifyRequest & { user?: JellyfinUser }).user;
  const token = getTokenFromRequest(request);
  if (!user || user.session !== "personal" || !token) return null;
  return { user, token };
}

export const libraryDeletionRoutes: FastifyPluginAsync = async (app) => {
  const { rights, delete: remove } = LIBRARY_DELETE_ROUTES;

  app.get(local(rights.path), { preHandler: requireAuth }, async (request, reply): Promise<LibraryDeletionRightsDto> => {
    reply.header("cache-control", "private, no-store");
    const session = personalToken(request);
    if (!session) return NO_LIBRARY_DELETION;
    return readDeletionRights(session.token);
  });

  app.post(
    local(remove.path),
    {
      preHandler: requireAuth,
      bodyLimit: 16 * 1024,
      config: { rateLimit: { max: remove.rateLimit.max, timeWindow: remove.rateLimit.windowMs } },
    },
    async (request, reply): Promise<LibraryDeleteResponse | LibraryDeleteRefusalBody> => {
      const session = personalToken(request);
      if (!session) {
        console.warn(`[library-delete] refusé : session ${(request as FastifyRequest & { user?: JellyfinUser }).user?.session ?? "inconnue"}, pas une session personnelle`);
        return reply.status(LIBRARY_DELETE_REFUSAL_STATUS.not_personal).send({ error: "not_personal" });
      }
      const ids = parseLibraryDeleteRequest(request.body);
      if (ids === null) return reply.status(LIBRARY_DELETE_REFUSAL_STATUS.invalid_input).send({ error: "invalid_input" });

      const results = await deleteLibraryItems(session.token, ids);
      const tally = tallyOutcomes(results);
      console.info(
        `[library-delete] ${session.user.username} (${session.user.userId.slice(0, 8)}…) : ${ids.length} demandés — ` +
          `${tally.deleted} supprimés, ${tally.gone} déjà absents, ${tally.forbidden} refusés par Jellyfin, ${tally.failed} en échec`,
      );
      afterLibraryDeletion(results.filter((r) => r.outcome === "deleted" || r.outcome === "gone").map((r) => r.id));
      return { results };
    },
  );
};
