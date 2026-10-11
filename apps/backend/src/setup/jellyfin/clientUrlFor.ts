import type { FastifyRequest } from "fastify";
import { readDefaultGateway } from "../discovery/candidates";
import { hostInfo } from "../hostInfo";
import { setupRuntime } from "../setupRuntime";
import { primaryLanAddress } from "../../services/primaryLanAddress";
import { clientJellyfinUrl } from "./clientUrl";

/** L'adresse principale de la machine, hors conteneur seulement (la sienne n'y vaut que sur le pont). */
export function hostLanAddress(): string | null {
  return hostInfo().containerized ? null : primaryLanAddress();
}

/** `clientJellyfinUrl` pour la requête en cours : son hôte, l'installation, la passerelle du conteneur. */
export function clientUrlFor(request: FastifyRequest, jellyfinUrl: string | null): string | null {
  return clientJellyfinUrl({
    deployment: setupRuntime().deployment,
    browserHost: request.hostname,
    jellyfinUrl,
    gateway: hostInfo().containerized ? readDefaultGateway() : null,
    lanAddress: hostLanAddress(),
  });
}
