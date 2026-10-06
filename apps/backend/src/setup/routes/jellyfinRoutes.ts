import type { FastifyPluginAsync } from "fastify";
import { hasPrisma } from "../../services/db";
import { discoverJellyfins } from "../discovery/discover";
import { hostInfo } from "../hostInfo";
import { apiKeyWorks, authenticate, createTentacleKey, signOut, verifyApiKey } from "../jellyfin/accounts";
import { clientJellyfinUrl } from "../jellyfin/clientUrl";
import { probeJellyfin } from "../jellyfin/probe";
import { jellyfinTarget } from "../jellyfin/stackTarget";
import { adoptProvisionalAdmin, applyServerLocale, finishJellyfinStartup, runJellyfinStartup } from "../jellyfin/startup";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import { prepareJellyfin, setupRuntime } from "../setupRuntime";
import { connectSchema, initializeSchema, probeSchema } from "../setupSchemas";
import { claimedAdminId, forgetClaim, saveJellyfin, storedJellyfin } from "../setupStore";
import type { JellyfinDiscoveryResponse, JellyfinProbeResult } from "../setupDiscoveryContract";

/**
 * Relier Jellyfin. Trois chemins, un seul résultat : l'adresse et la clé
 * « Tentacle » enregistrées. La clé ne sort jamais vers le client.
 *
 *  - Jellyfin voisin verrouillé au démarrage → il prend le compte choisi ;
 *  - Jellyfin VIERGE → Tentacle fait son assistant, avec le compte choisi ;
 *  - Jellyfin DÉJÀ configuré → son compte administrateur (la clé est créée
 *    d'office), ou une clé collée.
 */
const SESSION = { preHandler: requireSetupSession };
const limited = (max: number) => ({ ...SESSION, config: { rateLimit: { max, timeWindow: 60_000 } } });

function requireDatabase(): void {
  // Tout ce qui suit s'enregistre en base : sans elle, rien ne commence.
  if (!hasPrisma()) throw new SetupError("db_unreachable");
}

export const setupJellyfinRoutes: FastifyPluginAsync = async (app) => {
  /** POST /api/setup/jellyfin/probe — y a-t-il un Jellyfin là, vierge ou non, compatible ou non ? */
  app.post("/jellyfin/probe", limited(30), async (request): Promise<JellyfinProbeResult> => {
    const { url } = probeSchema.parse(request.body);
    const { url: found, version, serverName, blank, compatible } = await probeJellyfin(await jellyfinTarget(url));
    const clientUrl = clientJellyfinUrl({ deployment: setupRuntime().deployment, browserHost: request.hostname, jellyfinUrl: found });
    return { url: found, version, serverName, blank, compatible, clientUrl };
  });

  /**
   * GET /api/setup/jellyfin/discover — les Jellyfin joignables, le vierge
   * d'abord. Session exigée (installation ouverte), et peu d'appels : chacun
   * lance une quarantaine de sondes bornées.
   */
  app.get("/jellyfin/discover", limited(6), async (request): Promise<JellyfinDiscoveryResponse> =>
    discoverJellyfins({ deployment: setupRuntime().deployment, browserHost: request.hostname, containerized: hostInfo().containerized }),
  );

  /**
   * POST /api/setup/jellyfin/prepare — relance le verrouillage du Jellyfin
   * voisin (pile complète), sans l'attendre : l'assistant suit `/context`.
   */
  app.post("/jellyfin/prepare", limited(10), async (_request, reply) => {
    requireDatabase();
    void prepareJellyfin();
    return reply.status(202).send({ started: true });
  });

  /** POST /api/setup/jellyfin/initialize — un Jellyfin vierge (ou verrouillé par nous) prend le compte choisi. */
  app.post("/jellyfin/initialize", limited(10), async (request) => {
    const body = initializeSchema.parse(request.body);
    requireDatabase();

    const claimedId = claimedAdminId();
    const stored = storedJellyfin();
    if (claimedId && stored) {
      await adoptProvisionalAdmin(stored.url, stored.apiKey, claimedId, body);
      await applyServerLocale(stored.url, stored.apiKey, body);
      await forgetClaim();
      return { success: true };
    }

    const probed = await probeJellyfin(await jellyfinTarget(body.url));
    if (!probed.compatible) throw new SetupError("jf_incompatible_version");
    if (!probed.blank) throw new SetupError("jf_not_blank");
    await runJellyfinStartup(probed.url, body, body);
    const account = await authenticate(probed.url, body.username, body.password);
    try {
      await saveJellyfin(probed.url, await createTentacleKey(probed.url, account.token), probed.id);
    } finally {
      await signOut(probed.url, account.token);
    }
    return { success: true };
  });

  /** POST /api/setup/jellyfin/connect — un Jellyfin déjà configuré. */
  app.post("/jellyfin/connect", limited(10), async (request) => {
    const body = connectSchema.parse(request.body);
    requireDatabase();
    const probed = await probeJellyfin(await jellyfinTarget(body.url));
    if (!probed.compatible) throw new SetupError("jf_incompatible_version");

    if ("apiKey" in body) {
      await verifyApiKey(probed.url, body.apiKey);
      await saveJellyfin(probed.url, body.apiKey, probed.id);
      await forgetClaim();
      return { success: true };
    }

    const account = await authenticate(probed.url, body.username, body.password);
    try {
      if (!account.isAdmin) throw new SetupError("jf_not_admin");
      // Une reprise sur le MÊME Jellyfin garde sa clé : pas une « Tentacle » de plus.
      const stored = storedJellyfin();
      const key =
        stored && stored.url === probed.url && (await apiKeyWorks(stored.url, stored.apiKey))
          ? stored.apiKey
          : await createTentacleKey(probed.url, account.token);
      await saveJellyfin(probed.url, key, probed.id);
      await forgetClaim();
      // Compte posé, assistant de Jellyfin jamais fini : on le ferme.
      if (probed.blank) await finishJellyfinStartup(probed.url, key);
    } finally {
      await signOut(probed.url, account.token);
    }
    return { success: true };
  });
};
