import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkTmdbKey } from "../../services/tmdb/keyCheck";
import { requireStep } from "../flow/setupFlow";
import { rememberTmdbLater, saveSetupTmdbKey } from "../flow/tmdbChoice";
import { buildSetupContext } from "../setupContext";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import type { SetupContext } from "../setupWizardContract";

/** Une clé (jamais plus longue que ce qu'accepte l'administration), ou « plus tard ». */
const tmdbSchema = z.union([
  z.object({ apiKey: z.string().trim().min(1).max(128) }).strict(),
  z.object({ later: z.literal(true) }).strict(),
]);

/**
 * POST /api/setup/tmdb — la clé TMDB de l'assistant, DANS le parcours
 * (`requireStep("tmdb")` : Jellyfin choisi et relié). Une clé se VALIDE
 * auprès de TMDB avant d'être enregistrée, comme dans l'administration
 * (`checkTmdbKey`) : refusée → `tmdb_key_invalid`, TMDB muet →
 * `tmdb_unreachable` ; rien n'est alors écrit. Les tâches de fond (tendances,
 * recommandations) partent avec le serveur, à la fin de l'installation : rien
 * à lancer ici. La clé n'est jamais journalisée ni renvoyée.
 */
export const setupTmdbRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/tmdb",
    { preHandler: requireSetupSession, config: { rateLimit: { max: 10, timeWindow: 60_000 } } },
    async (request): Promise<SetupContext> => {
      const body = tmdbSchema.parse(request.body);
      requireStep("tmdb");
      if ("later" in body) {
        await rememberTmdbLater();
        request.log.info("[Setup] clé TMDB : plus tard");
      } else {
        const verdict = await checkTmdbKey(body.apiKey);
        if (verdict === "invalid") throw new SetupError("tmdb_key_invalid");
        if (verdict === "unreachable") throw new SetupError("tmdb_unreachable");
        await saveSetupTmdbKey(body.apiKey);
        request.log.info("[Setup] clé TMDB enregistrée");
      }
      return buildSetupContext(request);
    },
  );
};
