import type { FastifyPluginAsync } from "fastify";
import { hasPrisma } from "../../services/db";
import { readDefaultGateway } from "../discovery/candidates";
import { discoverJellyfins } from "../discovery/discover";
import { hostInfo } from "../hostInfo";
import { apiKeyWorks, authenticate, createTentacleKey, signOut, verifyApiKey } from "../jellyfin/accounts";
import { clientUrlFor } from "../jellyfin/clientUrlFor";
import { presentsAsBlank, probeTarget } from "../jellyfin/stackTarget";
import { adoptProvisionalAdmin, applyServerLocale, runJellyfinStartup } from "../jellyfin/startup";
import { designatesSelection } from "../flow/selectJellyfin";
import { chosen, noteKeyCreated, requireStep } from "../flow/setupFlow";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import { prepareJellyfin, setupRuntime } from "../setupRuntime";
import { connectSchema, initializeSchema, probeSchema } from "../setupSchemas";
import { claimedAdminId, forgetClaim, rememberChoice, saveJellyfin, setClaimAside, siblingClaimKey, storedJellyfin } from "../setupStore";
import type { JellyfinDiscoveryResponse, JellyfinProbeResult } from "../setupDiscoveryContract";

/**
 * Relier Jellyfin. Trois chemins, un seul résultat : l'adresse et la clé
 * « Tentacle » enregistrées. La clé ne sort jamais vers le client.
 *
 *  - Jellyfin voisin verrouillé au démarrage → il prend le compte choisi ;
 *  - Jellyfin VIERGE → Tentacle fait son assistant, avec le compte choisi ;
 *  - Jellyfin DÉJÀ configuré → son compte administrateur (la clé est créée
 *    d'office), ou une clé collée — rien n'y est créé (`joined`).
 *
 * Pile complète : son Jellyfin est proposé en tête, les autres restent
 * choisissables. Choisir un autre met la clé du voisin verrouillé de côté —
 * un retour sur lui le reprend.
 *
 * Le PARCOURS d'abord (`flow/setupFlow.ts`) : `initialize` (créer le compte)
 * n'existe que pour le Jellyfin NEUF choisi, `connect` que pour le Jellyfin
 * DÉJÀ configuré choisi — et toujours celui-là, jamais une autre adresse.
 * Sans choix, ou hors parcours : `step_refused`.
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
    const { probed, inStack } = await probeTarget(url);
    return {
      url: probed.url,
      serverId: probed.id,
      version: probed.version,
      serverName: probed.serverName,
      blank: presentsAsBlank(probed, inStack),
      inStack,
      compatible: probed.compatible,
      clientUrl: clientUrlFor(request, probed.url),
    };
  });

  /**
   * GET /api/setup/jellyfin/discover — les Jellyfin joignables, le vierge
   * d'abord. Session exigée (installation ouverte), et peu d'appels : chacun
   * lance une quarantaine de sondes bornées.
   */
  app.get("/jellyfin/discover", limited(6), async (request): Promise<JellyfinDiscoveryResponse> =>
    discoverJellyfins({
      deployment: setupRuntime().deployment,
      browserHost: request.hostname,
      containerized: hostInfo().containerized,
      gateway: hostInfo().containerized ? readDefaultGateway() : null,
      claimed: claimedAdminId() !== null,
    }),
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
    const selection = chosen(requireStep("initialize"));
    if (!designatesSelection(body.url, selection)) throw new SetupError("step_refused");

    const { siblingUrl } = setupRuntime().deployment;
    const { probed, inStack } = await probeTarget(selection.url);
    const claimedId = claimedAdminId();
    const claimKey = siblingUrl && inStack ? siblingClaimKey(siblingUrl) : null;
    if (claimedId && claimKey) {
      // Le Jellyfin de la pile, verrouillé au démarrage : il prend le compte choisi.
      await saveJellyfin(probed.url, claimKey, probed.id);
      await adoptProvisionalAdmin(probed.url, claimKey, claimedId, body);
      await applyServerLocale(probed.url, claimKey, body);
      await forgetClaim();
      // Sa clé « Tentacle » vient du verrouillage : c'est bien cette installation qui l'a créée.
      await noteKeyCreated(probed.url);
      await rememberChoice(probed.url, siblingUrl, false);
      return { success: true };
    }

    if (!probed.compatible) throw new SetupError("jf_incompatible_version");
    if (!probed.blank) throw new SetupError("jf_not_blank");
    await runJellyfinStartup(probed.url, body, body);
    const account = await authenticate(probed.url, body.username, body.password);
    try {
      await setClaimAside(siblingUrl);
      await saveJellyfin(probed.url, await createTentacleKey(probed.url, account.token), probed.id);
      await noteKeyCreated(probed.url);
      await rememberChoice(probed.url, siblingUrl, false);
    } finally {
      await signOut(probed.url, account.token);
    }
    return { success: true };
  });

  /** POST /api/setup/jellyfin/connect — un Jellyfin déjà configuré. */
  app.post("/jellyfin/connect", limited(10), async (request) => {
    const body = connectSchema.parse(request.body);
    requireDatabase();
    const selection = chosen(requireStep("connect"));
    if (!designatesSelection(body.url, selection)) throw new SetupError("step_refused");
    const { siblingUrl } = setupRuntime().deployment;
    const { probed, inStack } = await probeTarget(selection.url);
    if (!probed.compatible) throw new SetupError("jf_incompatible_version");
    // Redevenu vierge entre le choix et la connexion : ce n'est plus ce parcours-là, on rechoisit.
    if (presentsAsBlank(probed, inStack)) throw new SetupError("step_refused");
    // Un autre Jellyfin que celui de la pile : la clé du voisin verrouillé est gardée de côté.
    const relink = async (key: string) => {
      if (inStack) await forgetClaim();
      else await setClaimAside(siblingUrl);
      await saveJellyfin(probed.url, key, probed.id);
      await rememberChoice(probed.url, siblingUrl, !probed.blank);
    };

    if ("apiKey" in body) {
      await verifyApiKey(probed.url, body.apiKey);
      await relink(body.apiKey);
      return { success: true };
    }

    const account = await authenticate(probed.url, body.username, body.password);
    try {
      if (!account.isAdmin) throw new SetupError("jf_not_admin");
      // Une reprise sur le MÊME Jellyfin garde sa clé : pas une « Tentacle » de plus.
      const stored = storedJellyfin();
      const reused = stored && stored.url === probed.url && (await apiKeyWorks(stored.url, stored.apiKey));
      const key = reused ? stored.apiKey : await createTentacleKey(probed.url, account.token);
      await relink(key);
      if (!reused) await noteKeyCreated(probed.url);
    } finally {
      await signOut(probed.url, account.token);
    }
    return { success: true };
  });
};
