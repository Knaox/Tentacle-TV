/**
 * La résolution DNS des requêtes déléguées et des flux directs : une adresse
 * PRIVÉE (réseau local, boucle, lien local, CGNAT, multidiffusion) est refusée,
 * même pour un hôte déclaré — un nom public qui pointerait vers la box ou le
 * NAS de l'utilisateur ne fait pas du bureau une porte vers son réseau.
 *
 * La vérification se fait DANS la résolution que la connexion emploie
 * (`lookup` de `https.request`) : aucun écart entre l'adresse contrôlée et
 * celle qui est jointe (pas de « rebinding »).
 */

import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { isIP } from "node:net";

function v4Private(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** L'adresse est-elle hors d'Internet public ? */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return v4Private(ip);
  if (isIP(ip) !== 6) return true;
  const low = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(low);
  if (mapped?.[1]) return v4Private(mapped[1]);
  return low === "::" || low === "::1" || /^f[cd]/.test(low) || /^fe[89ab]/.test(low) || /^ff/.test(low) || low.startsWith("64:ff9b:") || low.startsWith("2001:db8:");
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** Le `lookup` à passer à `https.request` : refuse un nom qui résout vers une adresse privée. */
export function publicOnlyLookup(hostname: string, options: LookupOptions | number, callback: LookupCallback): void {
  const asked = typeof options === "number" ? options : options.family;
  const family = asked === "IPv4" ? 4 : asked === "IPv6" ? 6 : (asked ?? 0);
  const all = typeof options === "object" && options.all === true;
  dnsLookup(hostname, { all: true, family }, (err, addresses) => {
    if (err) return callback(err, all ? [] : "");
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
      const refused: NodeJS.ErrnoException = new Error(`adresse privée refusée pour ${hostname}`);
      refused.code = "EPRIVATE";
      return callback(refused, all ? [] : "");
    }
    const first = list[0];
    if (all || !first) callback(null, list);
    else callback(null, first.address, first.family);
  });
}
