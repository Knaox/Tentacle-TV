import type { ReverseProxyKind } from "./remoteAccessContract";

/**
 * Les redirections à créer sur la box, selon ce qui reçoit Internet :
 *
 * - un MANDATAIRE HTTPS (Caddy, Traefik, Nginx Proxy Manager…) : 443, et 80
 *   pour la redirection vers HTTPS et les certificats Let's Encrypt. Jellyfin
 *   passe par lui aussi : rien d'autre à ouvrir ;
 * - AUCUN mandataire : le port de Tentacle sur l'hôte, ET celui de Jellyfin
 *   (avec son vrai numéro), marqué facultatif tant que la lecture directe
 *   hors de la maison n'est pas allumée. C'est du HTTP en clair sur Internet
 *   — l'interface conseille le HTTPS.
 *
 * Le port extérieur vaut le port intérieur : c'est ce que les guides des box
 * proposent d'office, et ce que le test d'ouverture vérifie.
 */

export type PortRuleTarget = "proxy" | "tentacle" | "jellyfin";
export type PortRulePurpose = "https" | "http_redirect" | "tentacle" | "jellyfin";

export interface PortRule {
  external: number;
  internal: number;
  protocol: "TCP";
  target: PortRuleTarget;
  purpose: PortRulePurpose;
  /** Seulement si la lecture directe hors de la maison est allumée (Jellyfin, sans mandataire). */
  optional?: boolean;
}

export interface PortPlanInput {
  proxy: ReverseProxyKind;
  /** Le port de Tentacle sur l'hôte (`TENTACLE_HOST_PORT`). */
  hostPort: number;
  /** Le port de Jellyfin sur l'hôte, s'il est publié. */
  jellyfinHostPort: number | null;
  /** La lecture directe vise une adresse publique de Jellyfin : son port est alors à ouvrir pour de bon. */
  directPlayPublic: boolean;
}

function rule(port: number, target: PortRuleTarget, purpose: PortRulePurpose): PortRule {
  return { external: port, internal: port, protocol: "TCP", target, purpose };
}

export function planPorts(input: PortPlanInput): PortRule[] {
  if (input.proxy !== "none") return [rule(443, "proxy", "https"), rule(80, "proxy", "http_redirect")];
  const rules = [rule(input.hostPort, "tentacle", "tentacle")];
  if (input.jellyfinHostPort) rules.push({ ...rule(input.jellyfinHostPort, "jellyfin", "jellyfin"), ...(input.directPlayPublic ? {} : { optional: true }) });
  return rules;
}

/**
 * L'adresse IPv4 du serveur sur le réseau local, à donner à la box comme
 * destination : tirée de l'adresse locale de Tentacle, si c'en est une.
 */
export function lanAddressOf(localUrl: string | null): string | null {
  if (!localUrl) return null;
  try {
    const host = new URL(localUrl).hostname;
    return isPrivateIpv4(host) ? host : null;
  } catch {
    return null;
  }
}

/** 10/8, 172.16/12, 192.168/16 — les réseaux d'un domicile. */
export function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
