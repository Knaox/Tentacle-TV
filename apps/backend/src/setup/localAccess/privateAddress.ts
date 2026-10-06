import { BlockList, isIP } from "net";

/**
 * « Une adresse privée », au sens de l'assistant : RFC 1918, ULA IPv6, lien
 * local, boucle locale. Pas le CGNAT (100.64/10) : il est partagé entre
 * abonnés d'un même opérateur, et Tailscale l'emprunte — ni l'un ni l'autre
 * n'est « la maison ».
 */
const PRIVATE = new BlockList();
for (const [address, prefix] of [["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["127.0.0.0", 8], ["169.254.0.0", 16]] as const) {
  PRIVATE.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [["fc00::", 7], ["fe80::", 10], ["::1", 128]] as const) PRIVATE.addSubnet(address, prefix, "ipv6");

/** L'adresse nue : sans crochets, sans zone (`%eth0`), une IPv4 vue en IPv6 rendue à l'IPv4. */
export function bareIp(address: string): string {
  const bare = address.trim().replace(/^\[(.*)\]$/, "$1").replace(/%.*$/, "");
  return bare.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1] ?? bare;
}

export function isPrivateAddress(address: string | undefined): boolean {
  if (!address) return false;
  const ip = bareIp(address);
  const family = isIP(ip);
  if (family === 0) return false;
  return PRIVATE.check(ip, family === 4 ? "ipv4" : "ipv6");
}
