import { getCachedMetaMany, metaKey } from "../tmdb/metaCache";
import { enqueueCrawl } from "./metaCrawler";
import type { RecoRowItem } from "./rowItem";

/**
 * Pose la disponibilité streaming sur les items SERVIS dont elle est encore
 * inconnue — une lecture groupée du cache de métadonnées, jamais d'appel
 * réseau. `null` reste `null` quand le cache ne sait pas : le client ne
 * devine plus, le filtre strict exclut, le crawler comblera en fond.
 */
export async function attachProviders(items: RecoRowItem[]): Promise<void> {
  const pending = items.filter((item) => item.providers == null);
  if (pending.length === 0) return;
  const metas = await getCachedMetaMany(pending);
  for (const item of pending) {
    const meta = metas.get(metaKey(item.mediaType, item.tmdbId));
    item.providers = meta?.providers ?? null;
  }
  // Ce qu'on sert sans le savoir, le crawler l'apprendra en fond.
  const unknown = pending.filter((item) => item.providers === null);
  if (unknown.length > 0) {
    enqueueCrawl(unknown.map((item) => ({ mediaType: item.mediaType, tmdbId: item.tmdbId })));
  }
}
