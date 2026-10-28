import type { FastifyRequest } from "fastify";
import { getTokenFromRequest } from "../../../middleware/auth";
import { hashToken } from "../../../services/jwt";
import { CLIENT_FETCH_ANNOUNCE_HEADER } from "../pluginClientFetch";
import type { PluginRuntimeManifest } from "../pluginServerRuntime";
import { ClientFetchBroker, type ClientFetchBrokerDeps } from "./clientFetchBroker";
import { admitDeviceEgress, egressOfRequest } from "./deviceEgress";

/**
 * Le courtier en service, branché au démarrage par `index.ts` sur les sockets
 * d'appareil (`wsDeviceSockets.ts`) ; sans branchement, aucune poignée n'est
 * posée et `client.fetch` rend `offline` — tout passe par le serveur.
 */

let broker: ClientFetchBroker | null = null;

export function configureClientFetch(deps: ClientFetchBrokerDeps): ClientFetchBroker {
  // Les appareils derrière la même adresse partagent UN budget YouTube (`deviceEgress.ts`).
  broker = new ClientFetchBroker({ admit: admitDeviceEgress, ...deps });
  return broker;
}

export function clientFetchBroker(): ClientFetchBroker | null {
  return broker;
}

/** Pour les tests. */
export function resetClientFetchForTests(): void {
  broker = null;
}

/**
 * La poignée à poser sur une requête relayée : l'appareil s'est ANNONCÉ capable
 * (en-tête du bureau), l'extension déclare la famille `client` et ses hôtes,
 * et l'appareil a une socket ouverte. Sinon `null` : l'extension fait tout elle-même.
 */
export function relayClientHandle(pluginId: string, manifest: PluginRuntimeManifest, request: FastifyRequest): string | null {
  if (!broker || request.headers[CLIENT_FETCH_ANNOUNCE_HEADER] !== "1") return null;
  if (!manifest.clientFetch || !(manifest.hostApi ?? []).includes("client")) return null;
  const token = getTokenFromRequest(request);
  return token ? broker.handleFor(pluginId, hashToken(token), egressOfRequest(request)) : null;
}
