import type { FastifyPluginAsync } from "fastify";
import { authenticate, signOut } from "../jellyfin/accounts";
import { selectJellyfin } from "../flow/selectJellyfin";
import { requireStep } from "../flow/setupFlow";
import { buildSetupContext } from "../setupContext";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import { selectSchema, verifySchema } from "../setupSchemas";
import { storedJellyfin } from "../setupStore";
import type { SetupContext } from "../setupWizardContract";

/**
 * Le parcours : choisir le Jellyfin (jamais d'office), et revérifier le
 * compte administrateur après un rechargement de la page.
 */
const limited = (max: number) => ({ preHandler: requireSetupSession, config: { rateLimit: { max, timeWindow: 60_000 } } });

export const setupFlowRoutes: FastifyPluginAsync = async (app) => {
  /** POST /api/setup/jellyfin/select — le Jellyfin choisi ; la réponse est le contexte, parcours compris. */
  app.post("/jellyfin/select", limited(20), async (request): Promise<SetupContext> => {
    const { url } = selectSchema.parse(request.body);
    await selectJellyfin(url, (message) => request.log.info(`[Setup] ${message}`));
    return buildSetupContext(request);
  });

  /**
   * POST /api/setup/jellyfin/verify — le compte administrateur du Jellyfin
   * relié, revérifié : Jellyfin juge le mot de passe, rien n'est créé.
   */
  app.post("/jellyfin/verify", limited(10), async (request) => {
    const { username, password } = verifySchema.parse(request.body);
    requireStep("verify");
    const stored = storedJellyfin();
    if (!stored) throw new SetupError("jf_not_configured");
    const account = await authenticate(stored.url, username, password);
    try {
      if (!account.isAdmin) throw new SetupError("jf_not_admin");
    } finally {
      await signOut(stored.url, account.token);
    }
    return { success: true };
  });
};
