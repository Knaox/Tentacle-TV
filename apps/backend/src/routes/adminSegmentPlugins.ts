import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePersonalAdmin } from "../middleware/auth";
import { segmentSetupStatus, startSegmentSetup } from "../services/segmentPlugins/segmentSetupJob";

/**
 * « Installer / réparer la détection des passages » : le même passage que
 * l'assistant, pour un serveur déjà installé. Enregistré depuis
 * `adminRoutes` (derrière `requireAdmin`) ; le lancer redémarre Jellyfin,
 * donc une session PERSONNELLE seulement — jamais une TV jumelée.
 * Contrat : `packages/shared/src/segmentPlugins/segmentPluginsContract.ts`.
 */

const startSchema = z.object({ restartWhilePlaying: z.boolean().optional() }).strict();

export const adminSegmentPluginsRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/jellyfin/segment-plugins — le dernier passage (ou celui qui tourne). */
  app.get("/jellyfin/segment-plugins", async () => segmentSetupStatus());

  /** POST /api/admin/jellyfin/segment-plugins — lance un passage, sans l'attendre. */
  app.post("/jellyfin/segment-plugins", { preHandler: requirePersonalAdmin }, async (request, reply) => {
    const parsed = startSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: "bad-request" });
    request.log.info({ restartWhilePlaying: parsed.data.restartWhilePlaying === true }, "[Passages] installation demandée par l'administrateur");
    void startSegmentSetup(parsed.data);
    return reply.status(202).send(segmentSetupStatus());
  });
};
