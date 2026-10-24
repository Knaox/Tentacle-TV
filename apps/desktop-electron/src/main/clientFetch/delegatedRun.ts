/**
 * Une requête déléguée, de bout en bout dans le principal : le manifeste lu sur
 * le serveur (avec les en-têtes de la SESSION, qui ne servent qu'à cette
 * lecture), le plafond de l'extension, puis l'exécution — avec les seuls
 * en-têtes que l'extension a décrits. Aucun identifiant du compte ne part vers
 * l'hôte joint (ni jeton, ni cookie : la requête ne passe pas par la session
 * de la page).
 */

import type { ClientFetchQuota } from "./clientFetchQuota";
import { runClientFetch, httpsHop, type Hop } from "./clientFetchRunner";
import type { ClientFetchOutcome, ClientFetchRequest } from "./pluginClientFetch";
import type { PluginManifests, ServerSession } from "./pluginManifests";

export interface DelegatedArgs extends ServerSession {
  pluginId: string;
  request: ClientFetchRequest;
}

export interface DelegatedDeps {
  manifests: Pick<PluginManifests, "of">;
  quota: ClientFetchQuota;
  hop?: Hop;
}

export async function runDelegated(args: DelegatedArgs, deps: DelegatedDeps): Promise<ClientFetchOutcome> {
  const manifest = await deps.manifests.of({ serverOrigin: args.serverOrigin, headers: args.headers }, args.pluginId);
  if (!manifest) return { ok: false, reason: "refused" };
  const release = deps.quota.take(args.pluginId);
  if (!release) return { ok: false, reason: "budget" };
  try {
    return await runClientFetch(args.request, manifest, deps.hop ?? httpsHop);
  } finally {
    release();
  }
}
