import { isIP } from "net";

/**
 * Le budget YouTube PAR ADRESSE DE SORTIE des appareils délégués (`client.fetch`).
 *
 * YouTube compte par adresse IP (~150 requêtes rapprochées, mesuré le 14/10). Chaque appareil a sa garde côté
 * extension (150/h) : trois téléphones derrière la même box en faisaient 450 depuis UNE adresse. Ici, tous les
 * appareils qui sortent par la même adresse partagent UN plafond — 150 par heure, 20 par minute, les gestes
 * d'abord (le fond n'est admis que sous 110 dans l'heure et 12 dans la minute : la minute garde 8 places aux
 * gestes) — et un appareil refusé reçoit `budget`, comme pour son propre plafond.
 *
 * L'adresse de sortie (`egressOf`) :
 * - une adresse PRIVÉE (même réseau que le serveur) sort par la box du serveur : clé `server` — l'appelant la
 *   compte dans le registre YouTube de l'hôte (`hostYouTubeLedger.ts`), avec le serveur lui-même ;
 * - l'adresse publique du serveur, quand elle est connue (dernier test d'accès à distance) : `server` aussi ;
 * - sinon l'adresse publique telle quelle ; en IPv6, son préfixe /64 (une box donne un /64 à tout son réseau).
 *
 * Pur : l'horloge est passée en argument.
 */

export type EgressKind = "play" | "prefetch";

export type EgressAdmission = { granted: true; waitMs: number } | { granted: false; retryAfterMs: number };

export interface EgressLimits {
  perHour: number;
  perMinute: number;
  /** Le fond n'est admis que sous ce total de la minute. */
  prefetchPerMinute: number;
  /** Le fond n'est admis que sous ce total de l'heure. */
  prefetchBelow: number;
  /** Cadence entre deux places accordées à une même adresse. */
  spacingMs: number;
  /** Adresses suivies à la fois (les moins récentes sont oubliées). */
  maxAddresses: number;
}

export const DEVICE_EGRESS_LIMITS: EgressLimits = {
  perHour: 150,
  perMinute: 20,
  prefetchPerMinute: 12,
  prefetchBelow: 110,
  spacingMs: 250,
  maxAddresses: 2_000,
};

/** La clé du serveur lui-même : à compter dans le registre de l'hôte. */
export const SERVER_EGRESS = "server";

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Les huit groupes d'une adresse IPv6, `null` si elle n'en est pas une. */
function ipv6Groups(ip: string): string[] | null {
  if (isIP(ip) !== 6) return null;
  const bare = ip.toLowerCase().split("%")[0] ?? "";
  const [head, tail] = bare.includes("::") ? bare.split("::") : [bare, null];
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = 8 - left.length - right.length;
  const groups = tail === null ? left : [...left, ...Array<string>(Math.max(0, missing)).fill("0"), ...right];
  return groups.length === 8 ? groups.map((g) => g.replace(/^0+(?=.)/, "")) : null;
}

/** La sortie vers YouTube d'un appareil vu sous l'adresse `ip`. */
export function egressOf(ip: string, serverPublic: readonly string[], isPrivate: (ip: string) => boolean): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
  const address = mapped ?? ip;
  if (isPrivate(address) || serverPublic.includes(address)) return SERVER_EGRESS;
  const groups = ipv6Groups(address);
  if (groups) {
    const prefix = groups.slice(0, 4).join(":");
    return serverPublic.some((s) => ipv6Groups(s)?.slice(0, 4).join(":") === prefix) ? SERVER_EGRESS : `v6:${prefix}::/64`;
  }
  return `v4:${address}`;
}

export class EgressBudget {
  private readonly starts = new Map<string, number[]>();
  private readonly nextStart = new Map<string, number>();

  constructor(private readonly limits: EgressLimits = DEVICE_EGRESS_LIMITS) {}

  /** Une place pour une requête sortant par `key` ; comptée dès l'accord, à l'instant où elle partira. */
  admit(key: string, kind: EgressKind, now: number): EgressAdmission {
    const list = (this.starts.get(key) ?? []).filter((at) => at > now - HOUR);
    const below = kind === "play" ? this.limits.perHour : this.limits.prefetchBelow;
    if (list.length + 1 > below) return this.refuse(key, list, list.length - below, now, HOUR);
    const minute = list.filter((at) => at > now - MINUTE);
    if (minute.length + 1 > this.limits.perMinute) return this.refuse(key, list, minute.length - this.limits.perMinute, now, MINUTE, minute);
    if (kind === "prefetch" && minute.length + 1 > this.limits.prefetchPerMinute) {
      return this.refuse(key, list, minute.length - this.limits.prefetchPerMinute, now, MINUTE, minute);
    }
    const startAt = Math.max(now, this.nextStart.get(key) ?? 0);
    this.nextStart.set(key, startAt + this.limits.spacingMs);
    list.push(startAt);
    this.keep(key, list);
    return { granted: true, waitMs: startAt - now };
  }

  /** Requêtes de l'heure pour cette sortie (administration, tests). */
  usedInHour(key: string, now: number): number {
    return (this.starts.get(key) ?? []).filter((at) => at > now - HOUR).length;
  }

  private refuse(key: string, list: number[], index: number, now: number, window: number, within: number[] = list): EgressAdmission {
    this.keep(key, list);
    const freedAt = (within[Math.max(0, index)] ?? now) + window;
    return { granted: false, retryAfterMs: Math.max(1, freedAt - now) };
  }

  /** Garde la liste (la plus récente en dernier dans la table) ; au-delà du nombre d'adresses suivies, la plus ancienne part. */
  private keep(key: string, list: number[]): void {
    this.starts.delete(key);
    if (list.length > 0) this.starts.set(key, list);
    else this.nextStart.delete(key);
    while (this.starts.size > this.limits.maxAddresses) {
      const oldest = this.starts.keys().next().value as string;
      this.starts.delete(oldest);
      this.nextStart.delete(oldest);
    }
  }
}
