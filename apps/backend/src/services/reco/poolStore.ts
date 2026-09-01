import { getPrisma } from "../db";
import type { PoolPayload } from "./generationJob";

/** Rangée interne portant le pool classé (jamais servie telle quelle à l'UI). */
export const POOL_ROW_KEY = "pool";

/** Durée de vie du pool en cache — la page relance la génération au-delà. */
export const POOL_TTL_MS = 6 * 3600_000;

/** Le pool en cache, ou null (absent/expiré/illisible). */
export async function readPool(userId: string): Promise<PoolPayload | null> {
  const prisma = getPrisma();
  const row = await prisma.recommendationCache.findUnique({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: userId, rowKey: POOL_ROW_KEY } },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  try {
    return JSON.parse(row.payload) as PoolPayload;
  } catch {
    return null;
  }
}

/** Écrit (ou remplace) le pool du compte, TTL rechargé. */
export async function writePool(userId: string, payload: PoolPayload): Promise<void> {
  const prisma = getPrisma();
  await prisma.recommendationCache.upsert({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: userId, rowKey: POOL_ROW_KEY } },
    create: {
      jellyfinUserId: userId,
      rowKey: POOL_ROW_KEY,
      payload: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + POOL_TTL_MS),
    },
    update: {
      payload: JSON.stringify(payload),
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + POOL_TTL_MS),
    },
  });
}

/**
 * Jette le pool : quand un réglage change la MATIÈRE (les sources interrogées)
 * et pas seulement le service, attendre l'expiration (6 h) trahirait le
 * réglage. La prochaine requête relance une génération.
 */
export async function invalidatePool(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.recommendationCache.deleteMany({
    where: { jellyfinUserId: userId, rowKey: POOL_ROW_KEY },
  });
}
