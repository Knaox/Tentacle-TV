import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";

export interface WatchProviderEntry {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface WatchProviderDirectory {
  region: string;
  providers: WatchProviderEntry[];
}

/**
 * L'annuaire des plateformes de la région du serveur, logos compris — en
 * cache sept jours côté serveur, une journée ici : les logos ne bougent pas.
 * Sans clé TMDB, `providers` est vide.
 */
export function useWatchProviders() {
  return useQuery({
    queryKey: ["tmdb", "watch-providers"],
    queryFn: () => tentacleApiFetch<WatchProviderDirectory>("/api/tmdb/watch-providers"),
    staleTime: 24 * 3600_000,
  });
}
