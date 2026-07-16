import { getItemsByIds } from "./jellyfin";

// Résout le tmdbId TMDB de la SÉRIE parente d'un épisode. Indispensable à
// l'anti-doublon (claims Seer) : le `ProviderIds.Tmdb` d'un Episode est le tmdb
// de l'ÉPISODE, jamais celui de la série. On passe donc par le SeriesId (GUID
// Jellyfin) → on interroge l'item Series → son `ProviderIds.Tmdb` EST le tmdb tv.
// Cache mémoire borné (un même SeriesId revient à chaque nouvel épisode ajouté).

const CACHE_CAP = 1000;
const cache = new Map<string, number>(); // seriesId (GUID) → tmdbId tv

/** Borne la RAM : purge FIFO (Map = ordre d'insertion) au-delà du plafond. */
function remember(seriesId: string, tmdbId: number): void {
  if (cache.size >= CACHE_CAP) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(seriesId, tmdbId);
}

/**
 * Renvoie une Map seriesId → tmdbId tv pour les IDs fournis (seuls ceux résolus
 * y figurent). Ne fetch QUE les IDs absents du cache (champs minimaux : l'appel
 * getItemsByIds ramène déjà `ProviderIds`).
 */
export async function resolveSeriesTmdbIds(seriesIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const missing: string[] = [];
  for (const id of new Set(seriesIds)) {
    const hit = cache.get(id);
    if (hit !== undefined) out.set(id, hit);
    else missing.push(id);
  }
  if (missing.length === 0) return out;

  const items = await getItemsByIds(missing);
  for (const it of items) {
    if (it.Type === "Series" && it.tmdbId != null) {
      remember(it.Id, it.tmdbId);
      out.set(it.Id, it.tmdbId);
    }
  }
  return out;
}
