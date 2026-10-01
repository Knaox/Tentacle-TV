import { getPrisma, hasPrisma } from "./db";
import { hashToken, verifyDeviceToken, type DeviceTokenPayload } from "./jwt";

/**
 * « Ce jeton d'appareil est-il encore jumelé ? » — le verdict UNIQUE de toutes
 * les portes : routes REST (`middleware/auth.ts`), proxy Jellyfin et tuiles de
 * trickplay, rafraîchissement, socket temps réel.
 *
 * Un jeton d'appareil n'expire jamais dans le temps : sa validité, c'est la
 * ligne `paired_devices` de son empreinte. Le proxy l'ignorait — un JWT signé,
 * même révoqué, y recevait la clé d'administration, et pour toujours.
 *
 * « Jumelé » est gardé quelques secondes en mémoire : un flux HLS ou une grille
 * d'affiches, ce sont des dizaines de requêtes par seconde, une lecture de base
 * chacune serait de trop. La révocation commune l'efface sur-le-champ
 * (`markDeviceRevoked`) ; le délai ne borne que ce qui supprimerait une ligne
 * sans passer par elle.
 *
 * « Révoqué » est définitif et retenu : une empreinte supprimée ne revient
 * jamais — chaque jumelage signe un jeton neuf, et aucun jeton n'est remis à
 * un appareil avant que sa ligne n'existe.
 */

export type PairedDeviceVerdict =
  | { status: "paired"; payload: DeviceTokenPayload; tokenHash: string }
  | { status: "revoked"; payload: DeviceTokenPayload; tokenHash: string }
  /** Base injoignable : on ne tranche pas — 503, jamais un déjumelage. */
  | { status: "unreachable"; payload: DeviceTokenPayload; tokenHash: string }
  /** Pas un jeton d'appareil (jeton Jellyfin, usurpation, signature inconnue). */
  | { status: "not_device" };

/** Ce qu'une porte HTTP répond à un jeton d'appareil révoqué. `revoked` est le
 *  seul feu vert de déjumelage des clients (cf. `routes/authRefresh.ts`). */
export const REVOKED_REPLY = { message: "Appareil révoqué", revoked: true } as const;

const PAIRED_TTL_MS = 15_000;
/** `lastSeen` n'a pas besoin d'une écriture par requête : une par minute. */
const LAST_SEEN_EVERY_MS = 60_000;
const CACHE_MAX = 2_000;

interface PairedEntry {
  expiresAt: number;
  lastSeenAt: number;
}

const paired = new Map<string, PairedEntry>();
const revoked = new Set<string>();

function remember(tokenHash: string, entry: PairedEntry): void {
  if (paired.size >= CACHE_MAX) {
    const now = Date.now();
    for (const [key, value] of paired) if (value.expiresAt <= now) paired.delete(key);
    if (paired.size >= CACHE_MAX) paired.clear();
  }
  paired.set(tokenHash, entry);
}

function touchLastSeen(tokenHash: string, entry: PairedEntry, now: number): void {
  if (now - entry.lastSeenAt < LAST_SEEN_EVERY_MS || !hasPrisma()) return;
  entry.lastSeenAt = now;
  getPrisma()
    .pairedDevice.updateMany({ where: { tokenHash }, data: { lastSeen: new Date(now) } })
    .catch(() => {});
}

export async function pairedDeviceStatus(token: string): Promise<PairedDeviceVerdict> {
  const payload = await verifyDeviceToken(token);
  if (!payload) return { status: "not_device" };
  const tokenHash = hashToken(token);
  if (revoked.has(tokenHash)) return { status: "revoked", payload, tokenHash };

  const now = Date.now();
  const hit = paired.get(tokenHash);
  if (hit && hit.expiresAt > now) {
    touchLastSeen(tokenHash, hit, now);
    return { status: "paired", payload, tokenHash };
  }
  if (!hasPrisma()) return { status: "unreachable", payload, tokenHash };

  let found: boolean;
  try {
    found = (await getPrisma().pairedDevice.findUnique({ where: { tokenHash }, select: { id: true } })) !== null;
  } catch {
    return { status: "unreachable", payload, tokenHash };
  }
  if (!found) {
    markDeviceRevoked(tokenHash);
    return { status: "revoked", payload, tokenHash };
  }
  // Une révocation arrivée PENDANT la lecture de base l'emporte.
  if (revoked.has(tokenHash)) return { status: "revoked", payload, tokenHash };
  const entry: PairedEntry = { expiresAt: now + PAIRED_TTL_MS, lastSeenAt: hit?.lastSeenAt ?? 0 };
  remember(tokenHash, entry);
  touchLastSeen(tokenHash, entry, now);
  return { status: "paired", payload, tokenHash };
}

/** La révocation est passée : plus aucune porte ne laisse entrer ce jeton. */
export function markDeviceRevoked(tokenHash: string): void {
  paired.delete(tokenHash);
  if (revoked.size >= CACHE_MAX) {
    const oldest = revoked.values().next().value;
    if (oldest !== undefined) revoked.delete(oldest);
  }
  revoked.add(tokenHash);
}

/** Une socket qui s'authentifiait pendant la révocation se reconnaît ici. */
export function isDeviceRevoked(tokenHash: string): boolean {
  return revoked.has(tokenHash);
}

/** Tests uniquement. */
export function resetPairedDeviceStatusForTests(): void {
  paired.clear();
  revoked.clear();
}
