import type { FastifyPluginAsync } from "fastify";
import { detectAppState, getAppState } from "../../services/configStore";
import { getDatabaseUrlSource, hasDatabaseUrl, hasPrisma, reconnectPrisma } from "../../services/db";
import { buildSetupContext } from "../setupContext";
import { SetupError } from "../setupErrors";
import { requireOpenSetup, requireSetupSession } from "../setupGuard";
import { isSetupClosed } from "../setupLock";
import { noteAcceptedCode, noteFailedCode } from "../setupRuntime";
import { sessionSchema } from "../setupSchemas";
import { openSetupSession } from "../setupSession";
import { discardSetupToken, normalizeSetupToken, readSetupToken, setupTokensMatch } from "../setupToken";
import type { SetupSessionResponse, SetupStatusResponse } from "../setupWizardContract";

/** L'état public, l'échange du code, et le contexte de l'assistant. */
export const setupSessionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/setup/status — PUBLIC, et gardé pour toujours : le web, le
   * bureau et webOS livrés en lisent `state`. Il ne dit rien de secret.
   */
  app.get("/status", async (): Promise<SetupStatusResponse> => {
    let state = getAppState();
    // Base revenue après un démarrage sans elle : on s'y reconnecte ici aussi.
    // Jamais une connexion déjà ouverte : l'assistant s'en sert peut-être en
    // ce moment même.
    if (state !== "running" && hasDatabaseUrl()) {
      if (!hasPrisma()) await reconnectPrisma();
      if (hasPrisma()) state = await detectAppState();
    }
    return {
      state,
      hasDbUrl: hasDatabaseUrl(),
      dbFromEnv: getDatabaseUrlSource() === "env",
      dbConnected: hasPrisma(),
      setupOpen: !isSetupClosed(),
    };
  });

  /**
   * POST /api/setup/session — le code lu dans les journaux, échangé UNE fois
   * contre une session. 5 essais par minute et par adresse ; au-delà de dix
   * codes faux en tout, le code change (`noteFailedCode`).
   */
  app.post(
    "/session",
    { preHandler: requireOpenSetup, config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (request): Promise<SetupSessionResponse> => {
      const { token } = sessionSchema.parse(request.body);
      const expected = readSetupToken();
      const given = normalizeSetupToken(token);
      if (!expected || !given || !setupTokensMatch(expected, given)) {
        noteFailedCode();
        throw new SetupError("invalid_token");
      }
      discardSetupToken();
      noteAcceptedCode();
      request.log.info("[Setup] code d'installation accepté : session ouverte");
      return { session: openSetupSession() };
    },
  );

  /** GET /api/setup/context — les étapes à montrer, selon l'installation. */
  app.get("/context", { preHandler: requireSetupSession }, async (request) => buildSetupContext(request.protocol === "https"));
};
