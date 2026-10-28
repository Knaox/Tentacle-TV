import type { FastifyRequest } from "fastify";
import { readLastCheck } from "../../../remoteAccess/remoteAccessSettings";
import { getRealClientIp, isPrivateIp } from "../../../services/networkUtils";
import { hostYouTubeBudget } from "../../../services/trailers/youtubeGuard";
import { EgressBudget, egressOf, SERVER_EGRESS, type EgressKind } from "./egressBudget";

/**
 * Le budget des appareils délégués PAR ADRESSE DE SORTIE, en service (règle : `egressBudget.ts`). Un appareil du
 * réseau du serveur sort par la même box : il est compté dans le registre YouTube de l'hôte, avec le serveur et
 * ses bandes-annonces (`hostYouTubeLedger.ts` : 150/h, 20/min, 100/h par extension, disjoncteur commun). Les autres
 * partagent le plafond de LEUR adresse.
 */

export const deviceEgressBudget = new EgressBudget();

/** L'adresse publique du serveur, connue seulement par le dernier test d'accès à distance (aucun appel ici), relue chaque minute. */
let serverPublic: { at: number; addresses: string[] } | null = null;
function serverPublicAddresses(now: number): string[] {
  if (serverPublic && now - serverPublic.at < 60_000) return serverPublic.addresses;
  let addresses: string[] = [];
  try {
    const last = readLastCheck();
    if (last?.outcome === "done") addresses = [last.publicIp.v4, last.publicIp.v6].filter((a): a is string => typeof a === "string" && a.length > 0);
  } catch {
    addresses = [];
  }
  serverPublic = { at: now, addresses };
  return addresses;
}

/** L'adresse de sortie de l'appareil qui fait cette requête relayée ; `null` : inconnue (aucun budget d'adresse). */
export function egressOfRequest(request: FastifyRequest): string | null {
  const ip = getRealClientIp(request) as string | undefined;
  return typeof ip === "string" && ip.length > 0 ? egressOf(ip, serverPublicAddresses(Date.now()), isPrivateIp) : null;
}

/** Le budget de cette sortie pour une requête déléguée de `pluginId`. */
export function admitDeviceEgress(egress: string, kind: EgressKind, pluginId: string): { granted: true; waitMs: number } | { granted: false } {
  const now = Date.now();
  if (egress === SERVER_EGRESS) {
    const admission = hostYouTubeBudget.admitExtension(pluginId, kind, 1, now);
    return admission.granted ? admission : { granted: false };
  }
  const admission = deviceEgressBudget.admit(egress, kind, now);
  return admission.granted ? admission : { granted: false };
}
