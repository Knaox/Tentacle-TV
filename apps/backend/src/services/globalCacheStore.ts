import { getPrisma } from "./db";

/** Compte sentinelle des caches GLOBAUX au serveur (un GUID Jellyfin n'a pas
 *  cette forme) : tendances, pouls, annuaire des plateformes. */
export const GLOBAL_CACHE_USER_ID = "__global__";

export interface GlobalCacheRow<T> {
  payload: T;
  generatedAt: Date;
  expiresAt: Date;
}

/**
 * Lit une ligne globale — MÊME périmée : la fraîcheur se juge sur le payload
 * (stale-while-refresh : une copie vieille vaut mieux qu'un trou). Null si
 * absente ou illisible.
 */
export async function readGlobalCache<T>(rowKey: string): Promise<GlobalCacheRow<T> | null> {
  const prisma = getPrisma();
  const row = await prisma.recommendationCache.findUnique({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: GLOBAL_CACHE_USER_ID, rowKey } },
  });
  if (!row) return null;
  try {
    return { payload: JSON.parse(row.payload) as T, generatedAt: row.generatedAt, expiresAt: row.expiresAt };
  } catch {
    return null;
  }
}

/** Écrit (ou remplace) une ligne globale ; `ttlMs` borne la purge horaire. */
export async function writeGlobalCache(rowKey: string, payload: unknown, ttlMs: number): Promise<void> {
  const prisma = getPrisma();
  const json = JSON.stringify(payload);
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.recommendationCache.upsert({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: GLOBAL_CACHE_USER_ID, rowKey } },
    create: { jellyfinUserId: GLOBAL_CACHE_USER_ID, rowKey, payload: json, expiresAt },
    update: { payload: json, generatedAt: new Date(), expiresAt },
  });
}
