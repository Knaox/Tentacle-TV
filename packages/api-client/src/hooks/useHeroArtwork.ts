import { useQuery } from "@tanstack/react-query";
import type { HeroArtwork } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "./usePreferences";

/** Les images de repli d'un titre (`GET /api/hero/artwork/:itemId`). */
export function fetchHeroArtwork(itemId: string): Promise<HeroArtwork[]> {
  return tentacleApiFetch<{ images?: HeroArtwork[] }>(`/api/hero/artwork/${encodeURIComponent(itemId)}`).then(
    (res) => res.images ?? []
  );
}

/**
 * Le repli de la bannière d'accueil pour UN titre — le fond TMDB, puis toute
 * image que Jellyfin a du titre et de sa série. `enabled` : seulement quand
 * les images annoncées du titre manquent ou ont échoué (shared
 * `needsHeroArtwork`) — jamais une requête par titre affiché. Une heure en
 * cache : une image de titre ne change pas d'un passage à l'autre.
 */
export function useHeroArtwork(itemId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["hero-artwork", itemId],
    queryFn: () => fetchHeroArtwork(itemId as string),
    enabled: enabled && !!itemId,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}
