import type { FastifyPluginAsync } from "fastify";
import { browseDirectory, createLibraries, listLibraries } from "../jellyfin/libraries";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import { browseSchema, librariesSchema } from "../setupSchemas";
import { storedJellyfin, type StoredJellyfin } from "../setupStore";
import type { BrowseResult, ExistingLibrary, LibraryOutcome } from "../setupWizardContract";

/** Les dossiers que voit Jellyfin, et ses bibliothèques — par la clé « Tentacle ». */
const SESSION = { preHandler: requireSetupSession };

function requireJellyfin(): StoredJellyfin {
  const stored = storedJellyfin();
  if (!stored) throw new SetupError("jf_not_configured");
  return stored;
}

export const setupLibraryRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/setup/jellyfin/browse?path= — un dossier ; sans chemin, la racine. */
  app.get("/jellyfin/browse", { ...SESSION, config: { rateLimit: { max: 120, timeWindow: 60_000 } } }, async (request): Promise<BrowseResult> => {
    const { path } = browseSchema.parse(request.query ?? {});
    const { url, apiKey } = requireJellyfin();
    return browseDirectory(url, apiKey, path ?? null);
  });

  /** GET /api/setup/jellyfin/libraries — ce qui existe déjà. */
  app.get("/jellyfin/libraries", SESSION, async (): Promise<ExistingLibrary[]> => {
    const { url, apiKey } = requireJellyfin();
    return listLibraries(url, apiKey);
  });

  /** POST /api/setup/jellyfin/libraries — crée ce qui manque ; une issue par bibliothèque. */
  app.post("/jellyfin/libraries", { ...SESSION, config: { rateLimit: { max: 10, timeWindow: 60_000 } } }, async (request): Promise<LibraryOutcome[]> => {
    const body = librariesSchema.parse(request.body);
    const { url, apiKey } = requireJellyfin();
    return createLibraries(url, apiKey, body.libraries, body);
  });
};
