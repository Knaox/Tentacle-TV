import type { MediaItem } from "@tentacle-tv/shared";
import type { RatingIdentity } from "@tentacle-tv/api-client";

/**
 * L'identité de notation d'un item Jellyfin — la clé canonique (mediaType,
 * tmdbId) du moteur. Rend null quand l'item n'est pas notable : pas de tmdbId
 * dans ses ProviderIds, ou un type hors film/série (les épisodes se notent
 * depuis le lecteur, avec le contexte série — pas depuis une carte).
 */
export function ratingIdentityForItem(item: MediaItem): RatingIdentity | null {
  const raw = item.ProviderIds?.Tmdb;
  if (!raw) return null;
  const tmdbId = Number(raw);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;
  if (item.Type === "Movie") return { mediaType: "movie", tmdbId };
  if (item.Type === "Series") return { mediaType: "series", tmdbId };
  return null;
}

/**
 * Le tvdbId de l'item, s'il en porte un : transmis à la notation pour ancrer
 * le mapping AniList des séries (la table Fribb pivote sur thetvdb_id).
 */
export function tvdbIdForItem(item: MediaItem): number | null {
  const raw = item.ProviderIds?.Tvdb;
  if (!raw) return null;
  const tvdbId = Number(raw);
  return Number.isFinite(tvdbId) && tvdbId > 0 ? tvdbId : null;
}
