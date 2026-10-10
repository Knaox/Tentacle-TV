import { isIP } from "net";

/**
 * Où l'assistant accepte d'aller chercher un Jellyfin. L'adresse vient de
 * l'utilisateur : le serveur ne doit pas devenir un relais vers ce qu'il est
 * seul à joindre (SSRF).
 *
 *  - `ok` : réseau local (RFC 1918, ULA, CGNAT) ou Internet — là où vit Jellyfin ;
 *  - `loopback` : la machine elle-même. Accepté en natif (Jellyfin à côté),
 *    refusé dans Docker : `localhost` y désigne le conteneur de Tentacle ;
 *  - `forbidden` : jamais — non spécifiée, lien local (169.254/16 : les
 *    métadonnées des clouds), multidiffusion, réservée, diffusion. Une seule
 *    exception, décidée à la connexion et jamais ici : le nom de l'hôte sous
 *    Podman sans racine (`hostGateway.ts`).
 */
export type AddressClass = "ok" | "loopback" | "forbidden";

function v4Parts(ip: string): number[] | null {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

function classifyV4(ip: string): AddressClass {
  const p = v4Parts(ip);
  if (!p) return "forbidden";
  if (p[0] === 0) return "forbidden";
  if (p[0] === 127) return "loopback";
  if (p[0] === 169 && p[1] === 254) return "forbidden";
  if (p[0] >= 224) return "forbidden"; // 224/4 multidiffusion, 240/4 réservée, 255.255.255.255
  return "ok";
}

/** Les huit groupes d'une IPv6, IPv4 finale comprise ; `null` si elle est malformée. */
export function expandIpv6(ip: string): number[] | null {
  let text = ip.toLowerCase().replace(/%.*$/, "");
  const v4 = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const p = v4Parts(v4[1]);
    if (!p) return null;
    text = text.slice(0, -v4[1].length) + `${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  const values = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return values.every((n) => !Number.isNaN(n)) ? values : null;
}

function embeddedV4(g: number[]): string {
  return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
}

function classifyV6(ip: string): AddressClass {
  const g = expandIpv6(ip);
  if (!g) return "forbidden";
  const zeroPrefix = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeroPrefix(8)) return "forbidden"; // ::
  if (zeroPrefix(7) && g[7] === 1) return "loopback"; // ::1
  if (zeroPrefix(5) && g[5] === 0xffff) return classifyV4(embeddedV4(g)); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return classifyV4(embeddedV4(g)); // NAT64
  if ((g[0] & 0xffc0) === 0xfe80) return "forbidden"; // lien local
  if ((g[0] & 0xff00) === 0xff00) return "forbidden"; // multidiffusion
  if (g[0] === 0xfd00 && g[1] === 0x0ec2 && g.slice(2, 7).every((x) => x === 0) && g[7] === 0x254) {
    return "forbidden"; // métadonnées AWS en IPv6
  }
  return "ok";
}

export function classifyAddress(ip: string): AddressClass {
  const bare = ip.replace(/^\[(.*)\]$/, "$1");
  const family = isIP(bare.replace(/%.*$/, ""));
  if (family === 4) return classifyV4(bare);
  if (family === 6) return classifyV6(bare);
  return "forbidden";
}

/** Le nom désigne-t-il la machine elle-même, sans même le résoudre ? */
export function isLoopbackName(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1").replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  return isIP(host) !== 0 && classifyAddress(host) === "loopback";
}
