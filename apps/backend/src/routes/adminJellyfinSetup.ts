import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { applySetupAction, type ApplyError } from "../services/jellyfinSetup/setupActions";
import { buildSetupReport } from "../services/jellyfinSetup/setupService";
import { forgetTrailerReadiness } from "../services/jellyfinSetup/trailerReadiness";

/**
 * Les réglages recommandés de Jellyfin, vus et appliqués depuis
 * l'administration. Enregistré depuis `adminRoutes`, donc derrière
 * `requireAdmin`. Contrat : `packages/shared/src/jellyfinCompat/setupContract.ts`.
 */

const applySchema = z.object({
  action: z.enum([
    "enableTrickplay",
    "enableRealtimeMonitor",
    "setMetadataLanguage",
    "installChapterSegments",
    "generateTrickplay",
    "scanMediaSegments",
    "refreshMissingMetadata",
  ]),
  language: z.string().max(8).optional(),
  country: z.string().max(4).optional(),
});

/** Un refus porte un code que la page traduit. */
const STATUS: Record<ApplyError, number> = {
  "bad-request": 400,
  "not-configured": 409,
  busy: 409,
  rejected: 502,
  unreachable: 502,
  invalid: 502,
  "not-applied": 502,
};

export const adminJellyfinSetupRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/admin/jellyfin/setup — chaque réglage recommandé et l'état réel du serveur. */
  app.get("/jellyfin/setup", async () => buildSetupReport());

  /** POST /api/admin/jellyfin/setup/apply — un geste en un clic, puis l'état relu. */
  app.post("/jellyfin/setup/apply", async (request, reply) => {
    const parsed = applySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "bad-request" });
    const outcome = await applySetupAction(parsed.data);
    if (!outcome.ok) return reply.status(STATUS[outcome.error]).send({ error: outcome.error });
    request.log.info({ action: parsed.data.action, changed: outcome.changed }, "[jellyfin-setup] réglage appliqué");
    // Le résumé que lisent les fiches se refait au prochain appel.
    forgetTrailerReadiness();
    return { changed: outcome.changed, report: await buildSetupReport() };
  });
};
