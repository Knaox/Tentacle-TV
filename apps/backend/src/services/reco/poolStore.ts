import { getPrisma } from "../db";
import type { PoolPayload } from "./generationJob";

/** Rangée interne portant le pool classé (jamais servie telle quelle à l'UI). */
export const POOL_ROW_KEY = "pool";

/** FRAÎCHEUR du pool : au-delà, il est servi tel quel et régénéré en fond
 *  (stale-while-revalidate) — plus jamais une page sans rangées. */
export const POOL_TTL_MS = 6 * 3600_000;

/** Durée de vie DISQUE : la purge horaire ne fauche qu'un pool que personne
 *  n'a régénéré depuis une semaine (compte parti). */
export const POOL_DISK_TTL_MS = 7 * 24 * 3600_000;

export interface PoolStamp {
  generatedAt: Date;
  expiresAt: Date;
}

/** Le pool a-t-il passé sa fraîcheur ? (ISO ou Date ; illisible = périmé) */
export function isPoolStale(generatedAt: Date | string, now = Date.now()): boolean {
  const at = typeof generatedAt === "string" ? Date.parse(generatedAt) : generatedAt.getTime();
  return !Number.isFinite(at) || now - at >= POOL_TTL_MS;
}

/** Les dates seules, sans le payload (1-3 Mo) : le chemin chaud du service. */
export async function readPoolStamp(userId: string): Promise<PoolStamp | null> {
  const prisma = getPrisma();
  const row = await prisma.recommendationCache.findUnique({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: userId, rowKey: POOL_ROW_KEY } },
    select: { generatedAt: true, expiresAt: true },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return { generatedAt: row.generatedAt, expiresAt: row.expiresAt };
}

/** Le pool et ses dates, ou null (absent, hors durée disque, illisible). */
export async function readPoolRow(
  userId: string
): Promise<{ pool: PoolPayload; stamp: PoolStamp } | null> {
  const prisma = getPrisma();
  const row = await prisma.recommendationCache.findUnique({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: userId, rowKey: POOL_ROW_KEY } },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  try {
    return {
      pool: JSON.parse(row.payload) as PoolPayload,
      stamp: { generatedAt: row.generatedAt, expiresAt: row.expiresAt },
    };
  } catch {
    return null;
  }
}

/** Le pool en cache, ou null — périmé compris (cf. isPoolStale). */
export async function readPool(userId: string): Promise<PoolPayload | null> {
  return (await readPoolRow(userId))?.pool ?? null;
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
      expiresAt: new Date(Date.now() + POOL_DISK_TTL_MS),
    },
    update: {
      payload: JSON.stringify(payload),
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + POOL_DISK_TTL_MS),
    },
  });
}

/**
 * Modifie le pool EN PLACE sans toucher ni `generatedAt` ni `expiresAt` —
 * `writePool` rechargerait le TTL à chaque patch et rendrait le pool immortel.
 * C'est le crawler qui pose les plateformes apprises. Concurrence optimiste :
 * l'écriture est conditionnée sur le `generatedAt` lu ; un pool régénéré
 * entre la lecture et l'écriture n'est jamais écrasé — « raced » n'est pas
 * une erreur, la nouvelle génération se ré-enfile seule.
 */
export async function patchPool(
  userId: string,
  mutate: (pool: PoolPayload) => boolean
): Promise<"patched" | "unchanged" | "missing" | "raced"> {
  const prisma = getPrisma();
  const row = await prisma.recommendationCache.findUnique({
    where: { jellyfinUserId_rowKey: { jellyfinUserId: userId, rowKey: POOL_ROW_KEY } },
  });
  if (!row) return "missing";
  let pool: PoolPayload;
  try {
    pool = JSON.parse(row.payload) as PoolPayload;
  } catch {
    return "missing";
  }
  if (!mutate(pool)) return "unchanged";
  const res = await prisma.recommendationCache.updateMany({
    where: { jellyfinUserId: userId, rowKey: POOL_ROW_KEY, generatedAt: row.generatedAt },
    data: { payload: JSON.stringify(pool) },
  });
  return res.count === 0 ? "raced" : "patched";
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
