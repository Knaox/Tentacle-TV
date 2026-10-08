import { isIP } from "net";
import { isTrustedProxy } from "../../services/trustedProxies";
import { bareIp, isPrivateAddress } from "./privateAddress";

/**
 * Ce navigateur arrive-t-il DIRECTEMENT du réseau local ? La seule question
 * qui ouvre l'assistant sans code. Toutes les conditions, sinon le code :
 *
 *  1. l'adresse réelle est connue. Elle ne l'est pas quand la connexion vient
 *     de la PASSERELLE du conteneur : Docker Desktop, colima, le relais IPv6
 *     de Docker (userland-proxy) y font passer TOUT le monde, Internet compris.
 *     Ni quand elle vient de l'adresse PROPRE du conteneur : rootlessport
 *     (Podman sans racine, réseau de pont — celui des piles compose) y fait
 *     arriver toute connexion publiée, du réseau local comme d'Internet
 *     (mesuré le 2026-10-08, Podman 5.8.7 : 10.89.x.2 vu pour l'hôte et le
 *     réseau local). La même adresse vient aussi, sous pasta ou en réseau
 *     de l'hôte, de la machine elle-même : le code lui est demandé aussi —
 *     on ne sait pas distinguer, donc on ne croit pas ;
 *  2. un en-tête de relais (`X-Forwarded-For`…) n'est cru que d'un mandataire
 *     voisin de confiance (`trustedProxies.ts`) — sinon c'est un client qui
 *     se dit local ;
 *  3. cette adresse est privée (RFC 1918, ULA, lien local, boucle locale) ;
 *  4. l'adresse TAPÉE dans le navigateur est elle aussi locale (IP privée,
 *     nom sans point, `.local`, `.lan`, `.home.arpa`…). Un nom de domaine
 *     public dit qu'on passe par Internet ou par un mandataire : un mandataire
 *     qui oublierait de transmettre l'adresse du client ne fait plus passer
 *     Internet pour la maison.
 */
export type ClientVerdict = "local" | "public" | "unknown";

export interface ClientFacts {
  /** L'adresse de la connexion (`request.socket.remoteAddress`). */
  peer: string | undefined;
  /** L'adresse réelle, à travers les mandataires de confiance (`getRealClientIp`). */
  realIp: string;
  headers: Record<string, string | string[] | undefined>;
  /** L'hôte tapé dans le navigateur (`request.hostname`). */
  browserHost: string | undefined;
  /** La passerelle du conteneur, si le serveur tourne dans un conteneur. */
  gateway: string | null;
  /** Les adresses du conteneur hors boucle locale, s'il tourne dans un conteneur ; vide sinon. */
  ownAddresses: readonly string[];
}

const FORWARDING_HEADERS = ["x-forwarded-for", "forwarded", "x-real-ip", "cf-connecting-ip", "true-client-ip"];
const LOCAL_SUFFIXES = [".local", ".lan", ".home", ".home.arpa", ".internal", ".localdomain", ".localhost", ".box"];

/** L'adresse tapée dans le navigateur désigne-t-elle le réseau local ? */
export function isLocalBrowserHost(raw: string | undefined): boolean {
  const host = raw?.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1").replace(/\.$/, "");
  if (!host) return false;
  if (isIP(host)) return isPrivateAddress(host);
  if (host === "localhost" || !host.includes(".")) return true;
  return LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function judgeClient(facts: ClientFacts): ClientVerdict {
  const peer = facts.peer ? bareIp(facts.peer) : "";
  if (!peer) return "unknown";
  if (facts.gateway && peer === facts.gateway) return "unknown";
  if (facts.ownAddresses.some((own) => bareIp(own) === peer)) return "unknown";
  const forwarded = FORWARDING_HEADERS.some((name) => facts.headers[name] !== undefined);
  if (forwarded && !isTrustedProxy(peer)) return "unknown";
  const client = forwarded ? bareIp(facts.realIp) : peer;
  // Un en-tête que le serveur ne sait pas lire (`Forwarded` seul) : l'adresse réelle reste inconnue.
  if (forwarded && client === peer) return "unknown";
  if (!isPrivateAddress(client)) return isIP(client) ? "public" : "unknown";
  return isLocalBrowserHost(facts.browserHost) ? "local" : "public";
}
