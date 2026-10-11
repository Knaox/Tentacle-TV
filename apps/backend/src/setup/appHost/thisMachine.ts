import type { FastifyRequest } from "fastify";
import { networkInterfaces } from "os";
import { clientAddress } from "../localAccess/localAccess";
import { bareIp } from "../localAccess/privateAddress";

/**
 * Le navigateur est-il sur la machine même du serveur ? La boîte « Choisir un
 * dossier » s'ouvre sur l'écran de CETTE machine : un navigateur d'ailleurs
 * ne la verrait jamais, et la ferait surgir devant quelqu'un d'autre.
 *
 * Les DEUX adresses doivent être de la machine : celle de la connexion
 * (jamais un en-tête) et l'adresse réelle du client — un mandataire posé sur
 * la machine verrait sinon un client distant comme local.
 */
function ownAddresses(): Set<string> {
  const own = new Set<string>(["127.0.0.1", "::1"]);
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) own.add(bareIp(entry.address));
  }
  return own;
}

export function isOwnAddress(address: string | undefined, own: ReadonlySet<string> = ownAddresses()): boolean {
  if (!address) return false;
  const ip = bareIp(address);
  return ip.startsWith("127.") || own.has(ip);
}

export function requestFromThisMachine(request: FastifyRequest): boolean {
  const own = ownAddresses();
  return isOwnAddress(request.socket?.remoteAddress, own) && isOwnAddress(clientAddress(request), own);
}
