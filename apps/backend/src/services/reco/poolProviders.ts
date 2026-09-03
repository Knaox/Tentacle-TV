import { getCachedMetaMany, metaKey } from "../tmdb/metaCache";
import type { TitleMeta } from "../tmdb/metaCache";
import type { PoolEntry } from "./generationJob";

/** Une identité TMDB à interroger (file du crawler). */
export interface CrawlTarget {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

/** Les ids des offres incluses d'une méta ; null = inconnu (méta absente ou
 *  d'avant la clé watch/providers). */
export function providerIdsOf(meta: TitleMeta | null | undefined): number[] | null {
  if (!meta || meta.providers === null) return null;
  return meta.providers.map((p) => p.id);
}

/**
 * Pose, depuis le CACHE seul, les providers des entrées qui ne les portent
 * pas encore — UNE lecture groupée pour tout le pool, zéro réseau. Ce que le
 * cache ignore reste null : c'est la file du crawler.
 */
export async function applyCachedProviders(
  entries: PoolEntry[]
): Promise<{ known: number; unknown: number }> {
  const pending = entries.filter((e) => e.providers == null);
  if (pending.length > 0) {
    const metas = await getCachedMetaMany(
      pending.map((e) => ({ mediaType: e.candidate.mediaType, tmdbId: e.candidate.tmdbId }))
    );
    for (const entry of pending) {
      const meta = metas.get(metaKey(entry.candidate.mediaType, entry.candidate.tmdbId));
      entry.providers = providerIdsOf(meta);
    }
  }
  let known = 0;
  for (const e of entries) if (e.providers) known++;
  return { known, unknown: entries.length - known };
}

/** Les entrées à disponibilité inconnue, dans l'ordre du pool (score
 *  décroissant) — les mieux classées d'abord au crawler. */
export function entriesNeedingProviders(entries: readonly PoolEntry[]): CrawlTarget[] {
  return entries
    .filter((e) => e.providers == null)
    .map((e) => ({ mediaType: e.candidate.mediaType, tmdbId: e.candidate.tmdbId }));
}
