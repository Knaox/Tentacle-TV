import type { FastifyPluginAsync } from "fastify";
import { detectAppState, getAppState } from "../../services/configStore";
import { hasPrisma, retryDatabaseOpen } from "../../services/db";
import { hostInfo } from "../hostInfo";
import { buildSetupContext } from "../setupContext";
import { SetupError } from "../setupErrors";
import { requireOpenSetup, requireSetupSession } from "../setupGuard";
import { isSetupClosed } from "../setupLock";
import { noteAcceptedCode, noteFailedCode } from "../setupRuntime";
import { sessionSchema } from "../setupSchemas";
import { openSetupSession } from "../setupSession";
import { claimantAddress, recordClaimant } from "../localAccess/claimant";
import { setupAccessFor } from "../localAccess/localAccess";
import { discardSetupToken, normalizeSetupToken, readSetupToken, setupTokensMatch } from "../setupToken";
import type { SetupHostInfo, SetupSessionResponse, SetupStatusResponse } from "../setupWizardContract";

/** L'état public, l'échange du code, et le contexte de l'assistant. */
export const setupSessionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/setup/status — PUBLIC, et gardé pour toujours : le web, le
   * bureau et webOS livrés en lisent `state`. Il ne dit rien de secret.
   */
  app.get("/status", async (): Promise<SetupStatusResponse> => {
    let state = getAppState();
    // Base qui ne s'ouvrait pas au démarrage : on réessaie ici aussi, au plus
    // toutes les 10 s (route publique), jamais à côté d'une MariaDB qui attend
    // sa migration (`retryDatabaseOpen`).
    if (state !== "running" && (await retryDatabaseOpen())) state = await detectAppState();
    return {
      state,
      // Gardés pour les clients livrés : la base n'a plus rien à configurer.
      hasDbUrl: true,
      dbFromEnv: true,
      dbConnected: hasPrisma(),
      setupOpen: !isSetupClosed(),
    };
  });

  /**
   * GET /api/setup/host — public tant que l'installation est ouverte : de quoi
   * dire, AVANT le code, comment lire les journaux de ce serveur (identifiant
   * du conteneur, pile). Rien qui ouvre quoi que ce soit ; 404 une fois fini.
   */
  app.get("/host", { preHandler: requireOpenSetup }, async (request): Promise<SetupHostInfo> => ({
    ...hostInfo(),
    codeRequired: setupAccessFor(request).refusal !== null,
  }));

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
      const { address } = setupAccessFor(request);
      // Le code prouve l'accès à la machine : il reprend l'installation, et la réclame si personne ne l'a fait.
      if (!claimantAddress()) recordClaimant(address);
      request.log.info("[Setup] code d'installation accepté : session ouverte");
      return { session: openSetupSession(address) };
    },
  );

  /**
   * POST /api/setup/session/local — SANS code : le premier navigateur qui
   * arrive directement du réseau local réclame l'installation. Sinon
   * `code_required` (adresse publique ou inconnue) ou `setup_in_progress`
   * (réclamée par une autre adresse) : l'assistant demande alors le code.
   */
  app.post(
    "/session/local",
    { preHandler: requireOpenSetup, config: { rateLimit: { max: 10, timeWindow: 60_000 } } },
    async (request): Promise<SetupSessionResponse> => {
      const access = setupAccessFor(request);
      if (access.refusal) {
        request.log.info({ verdict: access.verdict, refusal: access.refusal }, "[Setup] ouverture sans code refusée");
        throw new SetupError(access.refusal);
      }
      recordClaimant(access.address);
      request.log.info("[Setup] installation réclamée depuis le réseau local : session ouverte");
      return { session: openSetupSession(access.address) };
    },
  );

  /** GET /api/setup/context — les étapes à montrer, selon l'installation. */
  app.get("/context", { preHandler: requireSetupSession }, async (request) => buildSetupContext(request));
};
