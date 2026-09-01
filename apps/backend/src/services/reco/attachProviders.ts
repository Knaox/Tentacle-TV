import { getCachedMetaMany, metaKey } from "../tmdb/metaCache";
import type { RecoRowItem } from "./rowBuilder";

/**
 * Pose la disponibilité streaming sur les items SERVIS — une lecture groupée
 * du cache de métadonnées, jamais d'appel réseau au service. `providers`
 * absent = méta inconnue (le client ne filtre pas l'item) ; [] = aucune offre
 * incluse dans la région.
 */
export async function attachProviders(items: RecoRowItem[]): Promise<void> {
  if (items.length === 0) return;
  const metas = await getCachedMetaMany(items);
  for (const item of items) {
    const meta = metas.get(metaKey(item.mediaType, item.tmdbId));
    if (meta?.providers) item.providers = meta.providers;
  }
}
