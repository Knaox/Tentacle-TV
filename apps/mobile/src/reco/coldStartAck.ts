import type { StorageAdapter } from "@tentacle-tv/api-client";

/**
 * Accusé du démarrage à froid : la grille plein écran « dites-nous ce que vous
 * aimez » ne s'IMPOSE qu'une fois par compte et par appareil — ensuite, le
 * bandeau de la page la rouvre à volonté. Même format que le web
 * (`apps/web/src/lib/coldStartAck.ts`) : un tableau d'identifiants de comptes,
 * le plus récent en tête, borné — un appareil partagé garde l'accusé de chacun.
 */
const KEY = "tentacle_coldstart_ack";
const KEEP_MAX = 8;

function readAcks(storage: StorageAdapter): string[] {
  try {
    const raw = storage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function hasColdStartAck(storage: StorageAdapter, userId: string | null): boolean {
  return userId != null && readAcks(storage).includes(userId);
}

export function markColdStartAck(storage: StorageAdapter, userId: string | null): void {
  if (!userId) return;
  const next = [userId, ...readAcks(storage).filter((v) => v !== userId)].slice(0, KEEP_MAX);
  try {
    storage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage refusé : la grille se réimposera, sans casse.
  }
}
