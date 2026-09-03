import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";

export interface WatchProviderEntry {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface WatchProviderDirectory {
  region: string;
  /** Les plateformes de la région, dans l'ordre d'affichage TMDB. */
  providers: WatchProviderEntry[];
  /** id → logo : la région ET les familles connues même hors région — un
   *  logo pour toute famille du menu. Absent sur un vieux serveur. */
  logos?: Record<number, string>;
}

/** Clé DÉDIÉE (préfixe simple) : c'est elle que le persister met sur disque. */
export const WATCH_PROVIDERS_KEY = ["watch-providers"] as const;
const WATCH_PROVIDERS_STALE_TIME = 24 * 3600_000;

function fetchWatchProviders(): Promise<WatchProviderDirectory> {
  return tentacleApiFetch<WatchProviderDirectory>("/api/tmdb/watch-providers");
}

/**
 * L'annuaire des plateformes de la région du serveur, logos compris — en
 * cache sept jours côté serveur, une journée ici : les logos ne bougent pas.
 * Sans clé TMDB, `providers` est vide.
 */
export function useWatchProviders() {
  return useQuery({
    queryKey: WATCH_PROVIDERS_KEY,
    queryFn: fetchWatchProviders,
    staleTime: WATCH_PROVIDERS_STALE_TIME,
  });
}

export function prefetchWatchProviders(qc: QueryClient): Promise<void> {
  return qc.prefetchQuery({
    queryKey: WATCH_PROVIDERS_KEY,
    queryFn: fetchWatchProviders,
    staleTime: WATCH_PROVIDERS_STALE_TIME,
  });
}
