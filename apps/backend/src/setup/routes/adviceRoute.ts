import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { JellyfinSetupReport } from "../../services/jellyfinCompat/setupContract";
import { applySetupAction } from "../../services/jellyfinSetup/setupActions";
import { buildSetupReport } from "../../services/jellyfinSetup/setupService";
import { requireStep } from "../flow/setupFlow";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import { storedJellyfin } from "../setupStore";
import type { SetupAdviceAction, SetupAdviceOutcome } from "../setupWizardContract";

/**
 * Les réglages conseillés d'un Jellyfin DÉJÀ configuré, dans l'assistant :
 * le MÊME rapport et les MÊMES gestes que l'administration
 * (`/api/admin/jellyfin/setup`). Seuls les gestes cochés partent, un à la
 * fois, chacun relu par Jellyfin ; un échec n'arrête pas les suivants et
 * n'arrête jamais l'installation.
 */
const ACTIONS = ["setMetadataLanguage", "enableTrickplay", "enableRealtimeMonitor", "enableHevcEncoding", "shortenLibraryUpdateDelay"] as const satisfies readonly SetupAdviceAction[];

const adviceSchema = z
  .object({
    actions: z.array(z.enum(ACTIONS)).max(ACTIONS.length),
    language: z.string().max(8).optional(),
    country: z.string().max(4).optional(),
  })
  .strict();

const SESSION = { preHandler: requireSetupSession };

/** Les réglages conseillés n'appartiennent qu'au parcours d'un Jellyfin DÉJÀ configuré, relié. */
function requireJellyfin(): void {
  requireStep("advice");
  if (!storedJellyfin()) throw new SetupError("jf_not_configured");
}

export const setupAdviceRoute: FastifyPluginAsync = async (app) => {
  /** GET /api/setup/jellyfin/recommended — l'état réel, réglage par réglage. */
  app.get("/jellyfin/recommended", { ...SESSION, config: { rateLimit: { max: 30, timeWindow: 60_000 } } }, async (): Promise<JellyfinSetupReport> => {
    requireJellyfin();
    return buildSetupReport();
  });

  /** POST /api/setup/jellyfin/recommended — applique ce qui a été coché, rien d'autre. */
  app.post("/jellyfin/recommended", { ...SESSION, config: { rateLimit: { max: 10, timeWindow: 60_000 } } }, async (request): Promise<SetupAdviceOutcome[]> => {
    const body = adviceSchema.parse(request.body);
    requireJellyfin();
    const outcomes: SetupAdviceOutcome[] = [];
    for (const action of new Set(body.actions)) {
      const outcome = await applySetupAction({ action, language: body.language, country: body.country });
      outcomes.push(outcome.ok ? { action, status: "applied" } : { action, status: "failed", error: outcome.error });
    }
    request.log.info({ applied: outcomes.filter((o) => o.status === "applied").map((o) => o.action) }, "[Setup] réglages conseillés appliqués");
    return outcomes;
  });
};
