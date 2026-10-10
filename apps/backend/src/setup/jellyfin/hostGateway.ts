import { readFileSync } from "fs";
import { isIP } from "net";

/**
 * La seule adresse de lien local que l'assistant accepte : celle de l'HÔTE,
 * vue du conteneur sous Podman sans racine.
 *
 * Podman (réseau pasta, comme sur un réseau de pont) écrit dans `/etc/hosts`
 * `host.containers.internal` — et `host.docker.internal` quand la pile le
 * demande par `host-gateway` — vers 169.254.1.2 : une adresse que pasta
 * détourne vers l'hôte. Mesuré le 2026-10-08 (Podman 5.8.7) : la route par
 * défaut du conteneur ne passe PAS par elle ; la table de routage ne la prouve
 * donc pas. Ce qui la prouve, c'est le moteur de conteneurs qui l'a écrite.
 *
 * Trois conditions, toutes exigées — sinon 169.254/16 reste interdit
 * (métadonnées des clouds, SSRF) :
 *  - le nom TAPÉ est `host.docker.internal` ou `host.containers.internal`
 *    (une IP littérale de lien local ne passe jamais) ;
 *  - l'adresse obtenue est celle que `/etc/hosts` donne à CE nom — pas une
 *    réponse DNS ;
 *  - elle n'est dans aucun bloc de métadonnées connu (169.254.169.0/24 :
 *    AWS, GCP, Azure, OpenStack… ; 169.254.170.0/24 : ECS, EKS), même
 *    écrite dans `/etc/hosts`.
 */
export const HOST_GATEWAY_NAMES: readonly string[] = ["host.docker.internal", "host.containers.internal"];

const HOSTS_FILE = "/etc/hosts";

function normalizeName(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

export function isHostGatewayName(hostname: string): boolean {
  return HOST_GATEWAY_NAMES.includes(normalizeName(hostname));
}

/** Les adresses qu'un fichier hosts donne à ce nom (alias compris, commentaires ignorés). */
export function hostsFileAddresses(hostsFile: string | null, hostname: string): string[] {
  const name = normalizeName(hostname);
  const found: string[] = [];
  for (const line of (hostsFile ?? "").split("\n")) {
    const [address, ...names] = line.replace(/#.*$/, "").trim().split(/\s+/);
    if (!address || isIP(address) === 0) continue;
    if (names.some((entry) => normalizeName(entry) === name) && !found.includes(address)) found.push(address);
  }
  return found;
}

/** 169.254/16, hors des blocs de métadonnées des clouds. IPv4 seulement : aucun moteur n'écrit de lien local IPv6 ici. */
export function isGatewayLinkLocal(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split(".").map(Number);
  if (a !== 169 || b !== 254) return false;
  return c !== 169 && c !== 170;
}

/** L'exception, décidée : vrai seulement si les trois conditions tiennent. */
export function isHostGatewayException(hostname: string, ip: string, hostsFile: string | null): boolean {
  if (!isHostGatewayName(hostname) || !isGatewayLinkLocal(ip)) return false;
  return hostsFileAddresses(hostsFile, hostname).includes(ip);
}

/** `/etc/hosts`, relu à chaque fois (quelques centaines d'octets, et l'assistant sonde peu) ; `null` s'il manque. */
export function readHostsFile(): string | null {
  try {
    return readFileSync(HOSTS_FILE, "utf-8");
  } catch {
    return null;
  }
}
