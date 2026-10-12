import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePersonalAdmin } from "../middleware/auth";
import { startLibraryRescan } from "../library/libraryRescan";
import { LIBRARY_RESCAN_PATH, type LibraryRescanError } from "../library/libraryRescanContract";

/**
 * POST /api/admin/library/rescan — « Réanalyser maintenant ».
 *
 * Enregistré depuis `adminRoutes` (derrière `requireAdmin`), puis gardé par
 * `requirePersonalAdmin` : une TV jumelée par un administrateur porte
 * `isAdmin` dans son jeton, mais n'administre pas Jellyfin. Corps FERMÉ ;
 * l'identifiant est vérifié avant tout appel (`startLibraryRescan`).
 */

const bodySchema = z.object({ itemId: z.string().min(1).max(64).optional() }).strict();

const STATUS_OF: Record<LibraryRescanError, number> = {
  "bad-request": 400,
  "not-found": 404,
  busy: 409,
  "not-configured": 503,
  unreachable: 502,
  rejected: 502,
  failed: 502,
};

export const adminLibraryRescanRoutes: FastifyPluginAsync = async (app) => {
  app.post(LIBRARY_RESCAN_PATH, { preHandler: requirePersonalAdmin }, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: "bad-request" });
    const outcome = await startLibraryRescan(parsed.data.itemId, request.log);
    if (!outcome.ok) return reply.status(STATUS_OF[outcome.error]).send({ error: outcome.error });
    return reply.status(202).send({ ok: true, scope: outcome.scope });
  });
};
