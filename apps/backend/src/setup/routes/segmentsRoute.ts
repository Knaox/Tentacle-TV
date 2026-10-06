import type { FastifyPluginAsync } from "fastify";
import { segmentSetupStatus, startSegmentSetup } from "../../services/segmentPlugins/segmentSetupJob";
import type { SegmentSetupRun } from "../../services/segmentPlugins/segmentPluginsContract";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import { storedJellyfin } from "../setupStore";

/**
 * La détection des passages, configurée par l'assistant (Jellyfin neuf de la
 * pile complète comme Jellyfin existant) : le passage part en tâche de fond,
 * l'écran suit `GET`. Jamais de redémarrage de Jellyfin pendant une lecture
 * depuis l'assistant — l'administrateur seul peut le forcer, dans l'admin.
 */
export const setupSegmentsRoute: FastifyPluginAsync = async (app) => {
  /** POST /api/setup/jellyfin/segments — lance le passage (ou rend celui qui tourne). */
  app.post(
    "/jellyfin/segments",
    { preHandler: requireSetupSession, config: { rateLimit: { max: 10, timeWindow: 60_000 } } },
    async (_request, reply): Promise<SegmentSetupRun> => {
      if (!storedJellyfin()) throw new SetupError("jf_not_configured");
      void startSegmentSetup({ restartWhilePlaying: false });
      return reply.status(202).send(segmentSetupStatus());
    },
  );

  /** GET /api/setup/jellyfin/segments — où en est le passage. */
  app.get("/jellyfin/segments", { preHandler: requireSetupSession }, async (): Promise<SegmentSetupRun> => segmentSetupStatus());
};
