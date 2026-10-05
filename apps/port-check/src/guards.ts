import { isIP } from "net";
import { buildBlockList, isInList } from "./sourceIp";

/**
 * Les garde-fous du service, en mémoire : le débit par demandeur, le défi à
 * usage unique, et le refus de sonder une adresse qui n'est pas publique.
 */

/** Les adresses qu'Internet ne route pas : réseaux privés, partagés, de documentation, réservés. */
const NON_PUBLIC = buildBlockList([
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
  "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24",
  "224.0.0.0/4", "240.0.0.0/4",
  "::/128", "::1/128", "100::/64", "2001:db8::/32", "fc00::/7", "fe80::/10", "ff00::/8",
]);

export function isPublicAddress(ip: string): boolean {
  return isIP(ip) !== 0 && !isInList(ip, NON_PUBLIC);
}

/** Le compte du débit : l'adresse en IPv4, le préfixe /64 en IPv6 (un abonné en a des milliards). */
export function rateKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const [head] = ip.split("::");
  const groups = ip.includes("::") ? head.split(":").filter(Boolean) : ip.split(":");
  return `${[...groups, "0", "0", "0", "0"].slice(0, 4).join(":")}::/64`;
}

export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly max: number, private readonly windowMs: number) {}

  take(key: string, now = Date.now()): boolean {
    if (this.buckets.size > 10_000) for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.max) return false;
    bucket.count += 1;
    return true;
  }
}

/** Un défi ne sert qu'une fois : rejoué dans les dix minutes, il est refusé. */
export class ChallengeLedger {
  private readonly seen = new Map<string, number>();
  constructor(private readonly ttlMs = 600_000, private readonly maxEntries = 50_000) {}

  claim(id: string, now = Date.now()): boolean {
    const expiresAt = this.seen.get(id);
    if (expiresAt !== undefined && expiresAt > now) return false;
    if (this.seen.size >= this.maxEntries) {
      for (const [k, exp] of this.seen) if (exp <= now) this.seen.delete(k);
      while (this.seen.size >= this.maxEntries) this.seen.delete(this.seen.keys().next().value as string);
    }
    this.seen.set(id, now + this.ttlMs);
    return true;
  }
}
