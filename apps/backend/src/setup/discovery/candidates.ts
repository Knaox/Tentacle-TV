import { isIP } from "net";
import { classifyAddress } from "../jellyfin/addressGuard";
import { isPrivateAddress } from "../localAccess/privateAddress";

/**
 * OÙ chercher un Jellyfin, sans balayer le réseau : quelques hôtes que l'on a
 * des raisons de croire voisins, et quelques ports.
 *
 *  - l'hôte du navigateur : la machine que l'administrateur vient de joindre
 *    (le plus souvent, celle qui porte aussi Jellyfin) ;
 *  - la passerelle du conteneur : l'hôte Docker vu du réseau en pont ;
 *  - `host.docker.internal` / `host.containers.internal`, s'ils se résolvent ;
 *  - en natif, la machine elle-même.
 *
 * Seulement des adresses privées (RFC 1918, ULA, boucle locale en natif), ou
 * celle que le navigateur a tapée. La garde de connexion de l'assistant
 * (`guardedFetch`) s'applique en plus à chaque sonde.
 */
export const MAX_HOSTS = 4;
/** 8096 (http), 8920 (https), puis une plage courte : un second Jellyfin sur la même machine. */
export const SCAN_PORTS: readonly number[] = [8096, 8920, 8097, 8098, 8099, 8100, 8101, 8102];

export interface CandidateInput {
  browserHost: string | undefined;
  gateway: string | null;
  native: boolean;
  /** Les noms de l'hôte Docker, résolus (adresses vides : inconnus). */
  dockerHostAddresses: string[];
}

function bare(host: string): string {
  return host.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1");
}

/** Une adresse IP que la découverte peut sonder : privée, jamais lien local ni réservée. */
export function isScannableIp(ip: string, native: boolean): boolean {
  const verdict = classifyAddress(ip);
  if (verdict === "forbidden") return false;
  if (verdict === "loopback") return native;
  return isPrivateAddress(ip);
}

export function candidateHosts(input: CandidateInput): string[] {
  const hosts: string[] = [];
  const add = (host: string) => {
    if (!hosts.includes(host) && hosts.length < MAX_HOSTS) hosts.push(host);
  };
  const browser = input.browserHost ? bare(input.browserHost) : "";
  // L'adresse du navigateur : tapée par l'administrateur, gardée même publique
  // (un nom de domaine), jamais si c'est une adresse interdite ou la boucle locale en Docker.
  if (browser && /^[a-z0-9.:-]+$/.test(browser)) {
    if (isIP(browser) === 0 || classifyAddress(browser) === "ok" || (input.native && classifyAddress(browser) === "loopback")) add(browser);
  }
  if (input.gateway && isScannableIp(input.gateway, input.native)) add(input.gateway);
  for (const address of input.dockerHostAddresses) if (isScannableIp(address, input.native)) add(address);
  if (input.native) add("127.0.0.1");
  return hosts;
}

/** La passerelle par défaut, lue dans `/proc/net/route` (Linux : adresses en hexadécimal petit-boutiste). */
export function parseDefaultGateway(routeTable: string | null): string | null {
  for (const line of (routeTable ?? "").split("\n").slice(1)) {
    const [, destination, gateway] = line.trim().split(/\s+/);
    if (destination !== "00000000" || !gateway || !/^[0-9A-Fa-f]{8}$/.test(gateway)) continue;
    const value = parseInt(gateway, 16);
    const ip = [value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >>> 24) & 255].join(".");
    return ip === "0.0.0.0" ? null : ip;
  }
  return null;
}

export function formatHost(host: string): string {
  return isIP(host) === 6 ? `[${host}]` : host;
}
