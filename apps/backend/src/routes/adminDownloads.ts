/**
 * Administration des droits de téléchargement — lecture/écriture DANS
 * Jellyfin (aucune copie Tentacle). Voir jellyfinAdminPolicy.ts pour la
 * règle GET-merge-POST intégral. Réservé aux admins (contexte admin : les
 * erreurs sont parlantes ici, contrairement aux routes utilisateur).
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { listUsersRights, updateUserRights } from "../services/jellyfinAdminPolicy";

const patchSchema = z
  .object({
    enableContentDownloading: z.boolean().optional(),
    enableMediaConversion: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.enableContentDownloading !== undefined ||
      value.enableMediaConversion !== undefined,
    { message: "empty patch" },
  );

const STATUS_BY_ERROR: Record<string, number> = {
  "jellyfin-not-configured": 503,
  "admin-key-missing": 503,
  "jellyfin-unreachable": 502,
  "user-not-found": 404,
  "policy-missing": 502,
  "update-failed": 502,
  "verify-failed": 502,
};

export const adminDownloadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  app.get("/users", async (_request, reply) => {
    try {
      return await listUsersRights();
    } catch (error) {
      const code = error instanceof Error ? error.message : "jellyfin-unreachable";
      return reply.status(STATUS_BY_ERROR[code] ?? 502).send({ error: code });
    }
  });

  app.put("/users/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    if (!/^[0-9a-fA-F-]{32,36}$/.test(userId)) {
      return reply.status(400).send({ error: "invalid-user" });
    }
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-patch" });
    }
    try {
      return await updateUserRights(userId, parsed.data);
    } catch (error) {
      const code = error instanceof Error ? error.message : "update-failed";
      return reply.status(STATUS_BY_ERROR[code] ?? 502).send({ error: code });
    }
  });
};
