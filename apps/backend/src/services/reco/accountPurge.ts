import { getPrisma } from "../db";
import { getJellyfinUsers, invalidateJellyfinUsers } from "../watchTogether/usersCache";
import { GLOBAL_CACHE_USER_ID } from "../globalCacheStore";

/**
 * Les comptes Jellyfin SUPPRIMÉS sortent du moteur : profil, pool, pages,
 * réglages et mémoire de l'affiché — sinon leurs pages se reconstruisaient
 * chaque nuit (la liste des comptes actifs se lit dans le cache des pages) et
 * leur pool avec. Le cache commun (`__global__`) n'est jamais touché.
 *
 * Prudence : un compte n'est purgé qu'absent de DEUX relevés de Jellyfin à
 * au moins PURGE_CONFIRM_MS d'intervalle (un relevé muet rend le cache d'avant,
 * un compte tout juste créé pourrait y manquer), et jamais sur une liste vide.
 */

/** Intervalle minimal entre le relevé qui constate l'absence et celui qui purge. */
export const PURGE_CONFIRM_MS = 50 * 60_000;

/** Absences constatées : compte → instant du premier relevé qui ne l'avait pas. */
const missingSince = new Map<string, number>();

/** Les identifiants Jellyfin s'écrivent avec ou sans tirets, en majuscules ou non. */
export function normalizeUserId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

/**
 * Pur : les comptes à purger maintenant. Met à jour `missing` (absences en
 * cours ; un compte revenu en sort) et rend ceux dont l'absence est confirmée.
 */
export function confirmedDeletions(
  known: Iterable<string>,
  live: ReadonlySet<string>,
  missing: Map<string, number>,
  now: number,
  confirmMs = PURGE_CONFIRM_MS
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of known) {
    if (id === GLOBAL_CACHE_USER_ID || seen.has(id)) continue;
    seen.add(id);
    if (live.has(normalizeUserId(id))) {
      missing.delete(id);
      continue;
    }
    const since = missing.get(id);
    if (since === undefined) missing.set(id, now);
    else if (now - since >= confirmMs) out.push(id);
  }
  for (const id of [...missing.keys()]) if (!seen.has(id)) missing.delete(id);
  return out;
}

/** Les comptes que le moteur connaît, toutes tables reco confondues. */
async function knownAccounts(): Promise<string[]> {
  const prisma = getPrisma();
  const [profiles, caches, settings, impressions] = await Promise.all([
    prisma.tasteProfile.findMany({ select: { jellyfinUserId: true } }),
    prisma.recommendationCache.findMany({ where: { jellyfinUserId: { not: GLOBAL_CACHE_USER_ID } }, select: { jellyfinUserId: true }, distinct: ["jellyfinUserId"] }),
    prisma.recoSettings.findMany({ select: { jellyfinUserId: true } }),
    prisma.recoImpression.findMany({ select: { jellyfinUserId: true }, distinct: ["jellyfinUserId"] }),
  ]);
  return [...profiles, ...caches, ...settings, ...impressions].map((r) => r.jellyfinUserId);
}

/** Un relevé : purge les comptes dont l'absence est confirmée. Rend les comptes purgés. */
export async function purgeDeletedAccounts(now = Date.now()): Promise<string[]> {
  invalidateJellyfinUsers();
  const users = await getJellyfinUsers();
  if (!users || users.length === 0) return [];
  const live = new Set(users.map((u) => normalizeUserId(u.id)));
  const gone = confirmedDeletions(await knownAccounts(), live, missingSince, now);
  if (gone.length === 0) return [];
  const where = { jellyfinUserId: { in: gone } };
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.tasteProfile.deleteMany({ where }),
    prisma.recommendationCache.deleteMany({ where }),
    prisma.recoSettings.deleteMany({ where }),
    prisma.recoImpression.deleteMany({ where }),
  ]);
  for (const id of gone) missingSince.delete(id);
  console.log(`[Reco] ${gone.length} compte(s) supprimé(s) de Jellyfin : profil, pages et réglages reco purgés`);
  return gone;
}
