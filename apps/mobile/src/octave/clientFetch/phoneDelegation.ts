/**
 * Octave (mobile) — ce que le téléphone tient pour les requêtes déléguées, une fois par app : les manifestes
 * lus sur le serveur (aussi pour le flux direct du lecteur), le plafond par extension, et l'exécuteur que
 * l'agent partagé appelle (`useClientFetchAgent`).
 */

import { tentacleApiFetch, type ClientFetchExecutor } from "@tentacle-tv/api-client";
import { octaveAudioSupportsDirect } from "../../../modules/octave-audio";
import { ClientFetchQuota } from "./clientFetchQuota";
import type { DirectSourceDeps } from "./directSource";
import { runMobileClientFetch } from "./mobileClientFetch";
import { MobileManifests } from "./mobileManifests";

export const mobileManifests = new MobileManifests(() => tentacleApiFetch<unknown>("/api/plugins/active"));
const quota = new ClientFetchQuota();

export const runDelegatedOnPhone: ClientFetchExecutor = async (job) => {
  const manifest = await mobileManifests.of(job.pluginId);
  if (!manifest) return { ok: false, reason: "refused" };
  const release = quota.take(job.pluginId);
  if (!release) return { ok: false, reason: "budget" };
  try {
    return await runMobileClientFetch(job.request, manifest);
  } finally {
    release();
  }
};

/** Le flux direct d'un titre : le module sait-il le lire, et quels hôtes l'extension déclare-t-elle ? */
export const phoneDirectSources: DirectSourceDeps = {
  supported: octaveAudioSupportsDirect,
  mediaHosts: async (pluginId) => (await mobileManifests.of(pluginId))?.mediaHosts ?? [],
};
