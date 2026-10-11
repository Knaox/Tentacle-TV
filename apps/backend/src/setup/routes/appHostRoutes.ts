import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  detectLocalJellyfin, jellyfinInstallStatus, pickFolderOnHost, startJellyfinInstall, startLocalJellyfin,
} from "../appHost/appHostCalls";
import { requestFromThisMachine } from "../appHost/thisMachine";
import { requireStep } from "../flow/setupFlow";
import { folderVisible } from "../jellyfin/libraries";
import type { SetupJellyfinInstall, SetupJellyfinStart, SetupLocalJellyfin, SetupPickFolderResponse } from "../setupAppHostContract";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import { setupRuntime } from "../setupRuntime";
import { storedJellyfin } from "../setupStore";

/**
 * Les gestes de l'app Windows « Tentacle Server », relayés à son HÔTE par le
 * canal IPC (`appHost/`). Chacun est gardé comme le reste de l'assistant
 * (session, parcours — `setupFlowContract.ts`), et n'existe que dans l'app :
 * ailleurs, `host_unavailable`.
 *
 *  - le Jellyfin de la machine : le détecter, l'installer (installateur
 *    officiel, vérifié, lancé en interactif — jamais par-dessus un Jellyfin
 *    déjà là : Tentacle ne le met jamais à jour), le démarrer (installation
 *    simple ; un service, jamais) ;
 *  - la boîte « Choisir un dossier », seulement pour un navigateur sur la
 *    machine même — elle s'ouvre sur SON écran. Le dossier choisi repasse par
 *    `ValidatePath` de Jellyfin : c'est lui qui doit le voir, avec son compte.
 */
const SESSION = { preHandler: requireSetupSession };
const limited = (max: number) => ({ ...SESSION, config: { rateLimit: { max, timeWindow: 60_000 } } });

const pickFolderSchema = z
  .object({ initial: z.string().trim().max(1024).optional(), title: z.string().trim().max(200).optional() })
  .strict();

function requireAppHost(): void {
  if (setupRuntime().deployment.packaging !== "windows-app") throw new SetupError("host_unavailable");
}

export const setupAppHostRoutes: FastifyPluginAsync = async (app) => {
  /** GET /api/setup/jellyfin/local — le Jellyfin de cette machine. */
  app.get("/jellyfin/local", limited(30), async (): Promise<SetupLocalJellyfin> => {
    requireAppHost();
    requireStep("detectJellyfin");
    return detectLocalJellyfin();
  });

  /** POST /api/setup/jellyfin/install — l'installation guidée, en fond ; suivie par GET. */
  app.post("/jellyfin/install", limited(5), async (): Promise<SetupJellyfinInstall> => {
    requireAppHost();
    requireStep("installJellyfin");
    const local = await detectLocalJellyfin();
    if (local.state !== "absent" && !local.installing) throw new SetupError("step_refused");
    return startJellyfinInstall();
  });

  app.get("/jellyfin/install", limited(120), async (): Promise<SetupJellyfinInstall> => {
    requireAppHost();
    requireStep("installJellyfin");
    return jellyfinInstallStatus();
  });

  /** POST /api/setup/jellyfin/start — « Démarrer Jellyfin » (installation simple). */
  app.post("/jellyfin/start", limited(10), async (): Promise<SetupJellyfinStart> => {
    requireAppHost();
    requireStep("startJellyfin");
    return startLocalJellyfin();
  });

  /** POST /api/setup/jellyfin/pick-folder — la boîte de l'Explorateur, puis l'avis de Jellyfin. */
  app.post("/jellyfin/pick-folder", limited(20), async (request): Promise<SetupPickFolderResponse> => {
    const body = pickFolderSchema.parse(request.body ?? {});
    requireAppHost();
    requireStep("pickFolder");
    if (!requestFromThisMachine(request)) throw new SetupError("host_unavailable");
    const stored = storedJellyfin();
    if (!stored) throw new SetupError("jf_not_configured");
    const picked = await pickFolderOnHost({
      ...(body.initial ? { initial: body.initial } : {}),
      ...(body.title ? { title: body.title } : {}),
    });
    if (picked.path === null) return { status: "cancelled" };
    if (await folderVisible(stored.url, stored.apiKey, picked.path)) return { status: "picked", path: picked.path };
    // Un lecteur mappé que Jellyfin ne voit pas sous sa lettre : son chemin réseau est à proposer.
    if (picked.unc) return { status: "mapped_drive", path: picked.path, unc: picked.unc };
    return { status: "not_found", path: picked.path };
  });
};
