import { useMemo } from "react";
import type { MediaItem, ResolvedLicense, LicenseInfo, LicenseCreator } from "@tentacle-tv/shared";
import { KNOWN_OPEN_SOURCE_MEDIA, CC_LICENSE_MAP } from "@tentacle-tv/shared";

/** Crew types we extract from Jellyfin People for attribution */
const ATTRIBUTION_CREW_TYPES = ["Director", "Producer", "Writer", "Composer"] as const;

/**
 * Try to detect a CC license type from Jellyfin tags.
 * Returns the matching LicenseInfo or null.
 */
function detectLicenseFromTags(tags: string[]): LicenseInfo | null {
  for (const tag of tags) {
    const upper = tag.toUpperCase().trim();
    // Try exact match in CC_LICENSE_MAP keys
    for (const [key, info] of Object.entries(CC_LICENSE_MAP)) {
      if (upper === key.toUpperCase() || upper.includes(key.toUpperCase())) {
        return info;
      }
    }
  }
  return null;
}

/**
 * Build creators list from Jellyfin People metadata.
 */
function buildCreatorsFromPeople(
  people: MediaItem["People"]
): LicenseCreator[] {
  if (!people?.length) return [];
  return people
    .filter((p) =>
      ATTRIBUTION_CREW_TYPES.some((t) => t === p.Type)
    )
    .map((p) => ({
      name: p.Name,
      role: p.Type,
    }));
}

/**
 * Resolves license information for a given media item.
 *
 * Priority:
 * 1. Local KNOWN_OPEN_SOURCE_MEDIA database (curated, richest data)
 * 2. Dynamic resolution from Jellyfin tags + metadata (any CC-tagged media)
 * 3. null if no license detected
 */
export function useMediaLicense(item: MediaItem | undefined): ResolvedLicense | null {
  return useMemo(() => {
    if (!item) return null;

    // 1. Look up in local curated database (by providerIds, then title+year)
    const localMatch = KNOWN_OPEN_SOURCE_MEDIA.find((entry) => {
      if (entry.match.imdbId && item.ProviderIds?.Imdb === entry.match.imdbId) {
        return true;
      }
      if (entry.match.tmdbId && item.ProviderIds?.Tmdb === entry.match.tmdbId) {
        return true;
      }
      if (
        entry.match.title &&
        item.Name?.toLowerCase() === entry.match.title.toLowerCase() &&
        (!entry.match.year || item.ProductionYear === entry.match.year)
      ) {
        return true;
      }
      return false;
    });

    if (localMatch) {
      return {
        license: localMatch.license,
        attribution: localMatch.attribution,
        modifications: localMatch.modifications,
      };
    }

    // 2. Dynamic resolution from Jellyfin tags
    const detectedLicense = item.Tags?.length
      ? detectLicenseFromTags(item.Tags)
      : null;

    if (!detectedLicense) return null;

    // Build attribution dynamically from Jellyfin metadata
    const creators = buildCreatorsFromPeople(item.People);
    const studioName = item.Studios?.[0]?.Name;

    // Try to find a source URL from ExternalUrls
    const sourceExternal = item.ExternalUrls?.find(
      (u) => !u.Url.includes("imdb.com") && !u.Url.includes("themoviedb.org")
    );
    const sourceUrl = sourceExternal?.Url ?? "";
    const sourceName = sourceExternal?.Name ?? studioName ?? "";

    // Build copyright notice
    const copyrightHolder = studioName ?? creators[0]?.name ?? item.Name;
    const copyrightNotice = `\u00a9 ${copyrightHolder}`;

    return {
      license: detectedLicense,
      attribution: {
        copyrightNotice,
        creators,
        sourceUrl,
        sourceName,
      },
    };
  }, [item?.Id, item?.Name, item?.ProductionYear, item?.Tags, item?.ProviderIds, item?.People, item?.Studios, item?.ExternalUrls]);
}
