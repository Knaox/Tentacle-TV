import { BlockList, isIP } from "net";

/**
 * L'adresse du demandeur — la SEULE que le service teste. Derrière un
 * mandataire (`TRUSTED_PROXIES`), le dernier saut de `X-Forwarded-For` qui ne
 * soit pas lui-même un mandataire de confiance ; sinon l'adresse de la socket.
 * Un `X-Forwarded-For` venu d'ailleurs est ignoré : sinon n'importe qui ferait
 * sonder l'adresse de son choix.
 */
export function normalizeIp(address: string | undefined): string | null {
  if (!address) return null;
  const trimmed = address.trim().replace(/^\[|\]$/g, "");
  const mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  const ip = mapped ?? trimmed;
  return isIP(ip) ? ip.toLowerCase() : null;
}

export function buildBlockList(entries: string[]): BlockList {
  const list = new BlockList();
  for (const entry of entries) {
    const [address, bits] = entry.split("/");
    const ip = normalizeIp(address);
    if (!ip) continue;
    const family = isIP(ip) === 4 ? "ipv4" : "ipv6";
    if (bits === undefined) list.addAddress(ip, family);
    else {
      const prefix = Number(bits);
      if (Number.isInteger(prefix) && prefix >= 0 && prefix <= (family === "ipv4" ? 32 : 128)) list.addSubnet(ip, prefix, family);
    }
  }
  return list;
}

export function isInList(ip: string, list: BlockList): boolean {
  return list.check(ip, isIP(ip) === 4 ? "ipv4" : "ipv6");
}

export function sourceIpOf(socketAddress: string | undefined, forwardedFor: string | string[] | undefined, trusted: BlockList): string | null {
  const peer = normalizeIp(socketAddress);
  if (!peer || !isInList(peer, trusted) || !forwardedFor) return peer;
  const hops = (Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor).split(",").map((h) => normalizeIp(h));
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = hops[i];
    if (!hop) return null;
    if (!isInList(hop, trusted)) return hop;
  }
  return peer;
}
