import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { ratingsFromJellyfin } from "../userRights/userRightsOptions";
import type { RatingContext } from "./externalTitleRule";

/**
 * Ce que Jellyfin dit de son échelle de notes : son pays de métadonnées
 * (`/System/Configuration` → `MetadataCountryCode`) et la table qu'il expose pour ce
 * pays (`/Localization/ParentalRatings`). Relu au plus toutes les dix minutes ; un
 * échec garde la lecture précédente, et sans aucune lecture la table de Tentacle
 * sert seule (pays inconnu : les États-Unis d'abord, comme Jellyfin).
 */

const TTL_MS = 10 * 60_000;
let cache: { context: RatingContext; at: number } | null = null;
let pending: Promise<RatingContext> | null = null;

async function readContext(): Promise<RatingContext> {
  const [config, ratings] = await Promise.all([
    jellyfinAdminFetch<{ MetadataCountryCode?: string }>("/System/Configuration"),
    jellyfinAdminFetch<unknown>("/Localization/ParentalRatings"),
  ]);
  const country = config.ok && typeof config.data?.MetadataCountryCode === "string" ? config.data.MetadataCountryCode.trim().toUpperCase() : "";
  return {
    metadataCountry: /^[A-Z]{2}$/.test(country) ? country : (cache?.context.metadataCountry ?? null),
    live: ratings.ok ? ratingsFromJellyfin(ratings.data) : (cache?.context.live ?? []),
  };
}

export async function getRatingContext(): Promise<RatingContext> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.context;
  if (!pending) {
    pending = readContext()
      .catch(() => cache?.context ?? { metadataCountry: null, live: [] })
      .then((context) => {
        cache = { context, at: Date.now() };
        return context;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/** Vide le cache (tests). */
export function clearRatingContext(): void {
  cache = null;
}
