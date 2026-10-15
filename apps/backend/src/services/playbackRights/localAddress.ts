/**
 * « Ce client est-il sur le réseau local ? » — la même réponse que Jellyfin
 * (`NetworkManager.IsInLocalNetwork`, relu sur 10.11.11), pour plafonner le
 * débit des clients DISTANTS comme lui (docs/DROITS-UTILISATEURS.md § 9.2) :
 *
 * - la boucle locale l'est toujours ;
 * - si l'administrateur a donné ses réseaux locaux (`LocalNetworkSubnets`),
 *   eux seuls le sont, moins ceux qu'il exclut (`!10.0.5.0/24`) ;
 * - sinon les réseaux privés : RFC 1918, IPv6 unique local (fc00::/7) et
 *   site local (fec0::/10). Ni le lien local IPv4, ni le CGNAT.
 *
 * Règle pure : les réseaux viennent de Jellyfin (`serverNetwork.ts`).
 */

const PRIVATE_SUBNETS = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7", "fec0::/10"];

interface ParsedAddress {
  bits: bigint;
  width: 32 | 128;
}

function parseIpv4(text: string): bigint | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    value = (value << 8n) | BigInt(Number(part));
  }
  return value;
}

function parseIpv6(text: string): bigint | null {
  const [head, tail, extra] = text.toLowerCase().split("::");
  if (extra !== undefined) return null;
  const groups = (part: string | undefined) => (part ? part.split(":") : []);
  const left = groups(head);
  const right = tail === undefined ? [] : groups(tail);
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? missing !== 0 : missing < 1) return null;
  const all = [...left, ...Array<string>(tail === undefined ? 0 : missing).fill("0"), ...right];
  let value = 0n;
  for (const group of all) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return value;
}

/** Une adresse IPv4, IPv6, ou IPv4 dans IPv6 (`::ffff:192.168.1.2`, ramenée en IPv4). */
export function parseAddress(raw: string): ParsedAddress | null {
  const text = raw.trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(text);
  const v4 = parseIpv4(mapped ? mapped[1] : text);
  if (v4 !== null) return { bits: v4, width: 32 };
  const v6 = text.includes(":") ? parseIpv6(text) : null;
  return v6 !== null ? { bits: v6, width: 128 } : null;
}

function inSubnet(address: ParsedAddress, subnet: string): boolean {
  const [base, prefixText] = subnet.trim().split("/");
  const network = base ? parseAddress(base) : null;
  if (!network || network.width !== address.width) return false;
  const prefix = prefixText === undefined ? address.width : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > address.width) return false;
  const shift = BigInt(address.width - prefix);
  return address.bits >> shift === network.bits >> shift;
}

function isLoopback(address: ParsedAddress): boolean {
  return address.width === 32 ? address.bits >> 24n === 127n : address.bits === 1n;
}

/**
 * Vrai si Jellyfin tiendrait ce client pour local. `subnets` : son
 * `LocalNetworkSubnets` (vide = les réseaux privés). Adresse illisible :
 * distante — un plafond de trop vaut mieux qu'un plafond oublié.
 */
export function isLocalAddress(ip: string, subnets: readonly string[]): boolean {
  const address = parseAddress(ip);
  if (!address) return false;
  if (isLoopback(address)) return true;
  const included = subnets.filter((entry) => !entry.trim().startsWith("!") && parseAddress(entry.split("/")[0] ?? ""));
  const excluded = subnets.filter((entry) => entry.trim().startsWith("!")).map((entry) => entry.trim().slice(1));
  const lan = included.length > 0 ? included : PRIVATE_SUBNETS;
  return lan.some((subnet) => inSubnet(address, subnet)) && !excluded.some((subnet) => inSubnet(address, subnet));
}
