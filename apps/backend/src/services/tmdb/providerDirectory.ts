import { getConfigValue } from "../configStore";
import { tmdbConfigured, tmdbFetch } from "./client";
import type { ProviderRef } from "./metaCache";
import { mergeProviders } from "./providerMerge";
import type { RawWatchProvider } from "./providerMerge";

export interface WatchProviderDirectory {
  region: string;
  providers: ProviderRef[];
}

/** Les logos d'une région ne bougent pas : sept jours de cache mémoire. */
const DIRECTORY_TTL_MS = 7 * 24 * 3600_000;

/** Région watch-providers configurée (Admin → Métadonnées) — même règle que
 *  metaCache.normalizeProviders. */
export function watchRegion(): string {
  return getConfigValue("tmdb_watch_region") || "FR";
}

interface CacheEntry {
  fetchedAt: number;
  directory: WatchProviderDirectory;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<WatchProviderDirectory>>();

async function fetchDirectory(region: string): Promise<WatchProviderDirectory> {
  const [movie, tv] = await Promise.all([
    tmdbFetch<{ results?: RawWatchProvider[] }>("/watch/providers/movie", { watch_region: region }),
    tmdbFetch<{ results?: RawWatchProvider[] }>("/watch/providers/tv", { watch_region: region }),
  ]);
  return {
    region,
    providers: mergeProviders([...(movie.results ?? []), ...(tv.results ?? [])], region),
  };
}

/**
 * L'annuaire COMPLET des plateformes d'une région — deux appels TMDB
 * (`/watch/providers/movie` et `/tv`), fusionnés, en cache mémoire sept jours.
 * Sans clé TMDB : liste vide (le client garde ses initiales). En échec : la
 * copie périmée plutôt que rien.
 */
export async function getWatchProviderDirectory(
  region = watchRegion()
): Promise<WatchProviderDirectory> {
  if (!tmdbConfigured()) return { region, providers: [] };
  const cached = cache.get(region);
  if (cached && Date.now() - cached.fetchedAt < DIRECTORY_TTL_MS) return cached.directory;
  const pending = inFlight.get(region);
  if (pending) return pending;
  const p = fetchDirectory(region)
    .then((directory) => {
      cache.set(region, { fetchedAt: Date.now(), directory });
      return directory;
    })
    .catch(() => cached?.directory ?? { region, providers: [] })
    .finally(() => inFlight.delete(region));
  inFlight.set(region, p);
  return p;
}
