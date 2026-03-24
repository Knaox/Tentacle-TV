import { useMemo } from "react";
import type { MediaItem, ResolvedLicense, LicenseInfo, LicenseCreator } from "@tentacle-tv/shared";
import { KNOWN_OPEN_SOURCE_MEDIA, CC_LICENSE_MAP } from "@tentacle-tv/shared";

const ATTRIBUTION_CREW_TYPES = ["Director", "Producer", "Writer", "Composer"] as const;

function detectLicenseFromTags(tags: string[]): LicenseInfo | null {
  for (const tag of tags) {
    const upper = tag.toUpperCase().trim();
    for (const [key, info] of Object.entries(CC_LICENSE_MAP)) {
      if (upper === key.toUpperCase() || upper.includes(key.toUpperCase())) {
        return info;
      }
    }
  }
  return null;
}

function buildCreatorsFromPeople(people: MediaItem["People"]): LicenseCreator[] {
  if (!people?.length) return [];
  return people
    .filter((p) => ATTRIBUTION_CREW_TYPES.some((t) => t === p.Type))
    .map((p) => ({ name: p.Name, role: p.Type }));
}

/**
 * Resolves license information for a given media item.
 * 1. Local KNOWN_OPEN_SOURCE_MEDIA database (curated)
 * 2. Dynamic resolution from Jellyfin tags (CC-tagged content)
 * 3. null if no license detected
 */
export function useMediaLicense(item: MediaItem | undefined): ResolvedLicense | null {
  return useMemo(() => {
    if (!item) return null;

    const localMatch = KNOWN_OPEN_SOURCE_MEDIA.find((entry) => {
      if (entry.match.imdbId && item.ProviderIds?.Imdb === entry.match.imdbId) return true;
      if (entry.match.tmdbId && item.ProviderIds?.Tmdb === entry.match.tmdbId) return true;
      if (
        entry.match.title &&
        item.Name?.toLowerCase() === entry.match.title.toLowerCase() &&
        (!entry.match.year || item.ProductionYear === entry.match.year)
      ) return true;
      return false;
    });

    if (localMatch) {
      return {
        license: localMatch.license,
        attribution: localMatch.attribution,
        modifications: localMatch.modifications,
      };
    }

    const detectedLicense = item.Tags?.length ? detectLicenseFromTags(item.Tags) : null;
    if (!detectedLicense) return null;

    const creators = buildCreatorsFromPeople(item.People);
    const studioName = item.Studios?.[0]?.Name;
    const sourceExternal = item.ExternalUrls?.find(
      (u) => !u.Url.includes("imdb.com") && !u.Url.includes("themoviedb.org"),
    );
    const sourceUrl = sourceExternal?.Url ?? "";
    const sourceName = sourceExternal?.Name ?? studioName ?? "";
    const copyrightHolder = studioName ?? creators[0]?.name ?? item.Name;

    return {
      license: detectedLicense,
      attribution: {
        copyrightNotice: `\u00a9 ${copyrightHolder}`,
        creators,
        sourceUrl,
        sourceName,
      },
    };
  }, [item?.Id, item?.Name, item?.ProductionYear, item?.Tags, item?.ProviderIds, item?.People, item?.Studios, item?.ExternalUrls]);
}
