import type { FastifyRequest } from "fastify";
import { readDefaultGateway } from "../discovery/candidates";
import { hostInfo } from "../hostInfo";
import { setupRuntime } from "../setupRuntime";
import { clientJellyfinUrl } from "./clientUrl";

/** `clientJellyfinUrl` pour la requête en cours : son hôte, l'installation, la passerelle du conteneur. */
export function clientUrlFor(request: FastifyRequest, jellyfinUrl: string | null): string | null {
  return clientJellyfinUrl({
    deployment: setupRuntime().deployment,
    browserHost: request.hostname,
    jellyfinUrl,
    gateway: hostInfo().containerized ? readDefaultGateway() : null,
  });
}
