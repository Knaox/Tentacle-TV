import { BlockList, isIP } from "net";

/**
 * À qui Tentacle croit quand une requête dit « je relaie pour telle adresse »
 * (`X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP`) : à ses VOISINS
 * seulement — la machine, le réseau local, les réseaux de Docker — et à ce
 * que `TRUSTED_PROXIES` ajoute (adresses ou blocs CIDR, séparés par des
 * virgules : un mandataire hors réseau local, les plages de Cloudflare quand
 * Cloudflare joint directement le serveur).
 *
 * Avant, tout le monde était cru : un client d'Internet posait lui-même
 * `X-Forwarded-For` et contournait la limite des connexions (5 par minute),
 * ou se faisait passer pour le réseau local (débits, adresse privée de
 * Jellyfin). Un mandataire voisin (Nginx Proxy Manager, Caddy, Traefik,
 * cloudflared) reste cru, comme avant.
 */
const NEIGHBOURS = ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fc00::/7"];

function familyOf(address: string): "ipv4" | "ipv6" | null {
  const family = isIP(address);
  return family === 4 ? "ipv4" : family === 6 ? "ipv6" : null;
}

export function buildTrustList(extra: string | undefined): BlockList {
  const list = new BlockList();
  const entries = [...NEIGHBOURS, ...(extra ?? "").split(",")].map((entry) => entry.trim()).filter(Boolean);
  for (const entry of entries) {
    const [address, bits] = entry.split("/");
    const family = familyOf(address);
    if (!family) continue;
    const prefix = Number(bits);
    if (bits === undefined) list.addAddress(address, family);
    else if (Number.isInteger(prefix) && prefix >= 0 && prefix <= (family === "ipv4" ? 32 : 128)) list.addSubnet(address, prefix, family);
  }
  return list;
}

const trusted = buildTrustList(process.env.TRUSTED_PROXIES);

export function isTrustedProxy(address: string | undefined, list: BlockList = trusted): boolean {
  if (!address) return false;
  // Une IPv4 vue par une socket IPv6 (`::ffff:192.168.1.10`).
  const ip = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1] ?? address;
  const family = familyOf(ip);
  return family !== null && list.check(ip, family);
}
