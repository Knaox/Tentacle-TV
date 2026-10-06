import { lookup } from "dns/promises";
import { BlockList, isIP } from "net";
import { networkInterfaces, type NetworkInterfaceInfo } from "os";

/**
 * Le Jellyfin de la pile complète se joint par un NOM (`http://jellyfin:8096`).
 * Rien ne garantit que ce nom désigne bien le conteneur de la pile : un service
 * renommé dans Portainer, et le DNS du conteneur passe la question au réseau
 * local, où une machine — ou un autre Jellyfin — peut porter ce nom. La pile
 * se retrouvait alors reliée au Jellyfin d'à côté, déjà configuré.
 *
 * La preuve, sans jamais parler à Docker : un voisin de pile est sur un réseau
 * que le conteneur de Tentacle partage. Le nom doit donc se résoudre dans l'un
 * des sous-réseaux de ses propres interfaces (hors boucle locale). Sinon, ce
 * n'est pas le Jellyfin de la pile.
 */
export interface SiblingCheckDeps {
  resolve: (hostname: string) => Promise<string[]>;
  interfaces: () => NodeJS.Dict<NetworkInterfaceInfo[]>;
}

const systemDeps: SiblingCheckDeps = {
  resolve: async (hostname) => (await lookup(hostname, { all: true })).map((entry) => entry.address),
  interfaces: networkInterfaces,
};

/** Les sous-réseaux que ce conteneur partage avec ses voisins de pile. */
export function ownSubnets(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): BlockList {
  const list = new BlockList();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.internal || !entry.cidr) continue;
      const [address, bits] = entry.cidr.split("/");
      const family = entry.family === "IPv4" ? "ipv4" : "ipv6";
      // Une adresse IPv6 de lien local est sur toutes les interfaces : elle ne prouve rien.
      if (family === "ipv6" && /^fe80:/i.test(address)) continue;
      list.addSubnet(address, Number(bits), family);
    }
  }
  return list;
}

export type SiblingVerdict = "same-network" | "elsewhere" | "unresolved";

export async function checkSiblingNetwork(siblingUrl: string, deps: SiblingCheckDeps = systemDeps): Promise<SiblingVerdict> {
  let hostname: string;
  try {
    hostname = new URL(siblingUrl).hostname.replace(/^\[(.*)\]$/, "$1");
  } catch {
    return "unresolved";
  }
  let addresses: string[];
  try {
    addresses = isIP(hostname) ? [hostname] : await deps.resolve(hostname);
  } catch {
    // Pas (encore) résolu : Jellyfin démarre, ou son conteneur est arrêté. La sonde le dira.
    return "unresolved";
  }
  if (addresses.length === 0) return "unresolved";
  const subnets = ownSubnets(deps.interfaces());
  const inside = addresses.every((address) => {
    const family = isIP(address) === 6 ? "ipv6" : "ipv4";
    return subnets.check(address, family);
  });
  return inside ? "same-network" : "elsewhere";
}
