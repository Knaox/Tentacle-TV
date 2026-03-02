import { useMemo } from "react";
import type { MediaItem, MediaLicense } from "@tentacle-tv/shared";
import { KNOWN_OPEN_SOURCE_MEDIA } from "@tentacle-tv/shared";

/** CC license tag patterns found in Jellyfin tags */
const CC_TAG_PATTERNS = [
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC-BY-NC-4.0",
  "CC-BY-NC-SA-4.0",
  "CC-BY-ND-4.0",
  "CC-BY-NC-ND-4.0",
  "CC0-1.0",
  "Creative Commons",
  "Public Domain",
] as const;

/**
 * Resolves license information for a given media item.
 * 1. Checks Jellyfin tags for CC license indicators
 * 2. Looks up KNOWN_OPEN_SOURCE_MEDIA by title+year or providerIds
 * 3. Returns null if no license is found
 */
export function useMediaLicense(item: MediaItem | undefined): MediaLicense | null {
  return useMemo(() => {
    if (!item) return null;

    // Check if Jellyfin tags contain a CC indicator
    const hasLicenseTag = item.Tags?.some((tag) =>
      CC_TAG_PATTERNS.some((p) => tag.toUpperCase().includes(p.toUpperCase()))
    );

    // Look up in local database by providerIds first, then by title+year
    const match = KNOWN_OPEN_SOURCE_MEDIA.find((entry) => {
      // Match by IMDB ID
      if (entry.match.imdbId && item.ProviderIds?.Imdb === entry.match.imdbId) {
        return true;
      }
      // Match by TMDB ID
      if (entry.match.tmdbId && item.ProviderIds?.Tmdb === entry.match.tmdbId) {
        return true;
      }
      // Match by title + year
      if (
        entry.match.title &&
        item.Name?.toLowerCase() === entry.match.title.toLowerCase() &&
        (!entry.match.year || item.ProductionYear === entry.match.year)
      ) {
        return true;
      }
      return false;
    });

    // Return match from local DB, or null if neither tag nor DB match
    if (match) return match;
    if (hasLicenseTag) {
      // Tag found but no local DB entry — we can't build a full TASL attribution
      // without more data, so return null (could be extended in the future)
      return null;
    }

    return null;
  }, [item?.Id, item?.Name, item?.ProductionYear, item?.Tags, item?.ProviderIds]);
}
