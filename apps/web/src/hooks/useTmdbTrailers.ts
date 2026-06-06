import { useQuery } from "@tanstack/react-query";
import type { TmdbVideo } from "../components/detail/mergeTrailers";

function getToken(): string {
  return localStorage.getItem("tentacle_token") ?? "";
}
function getBackendUrl(): string {
  return localStorage.getItem("tentacle_backend_url") || window.location.origin;
}

/**
 * Liste complète des vidéos TMDB (trailers + teasers) via la route backend
 * `/api/tmdb/trailers` (source Jellyseerr). Retourne `[]` si Seerr indisponible
 * → le consommateur retombe alors sur les RemoteTrailers Jellyfin.
 */
export function useTmdbTrailers(tmdbId: string | undefined, mediaType: "movie" | "tv" | undefined) {
  return useQuery({
    queryKey: ["tmdb-trailers", tmdbId, mediaType],
    queryFn: async (): Promise<TmdbVideo[]> => {
      const res = await fetch(
        `${getBackendUrl()}/api/tmdb/trailers?tmdbId=${tmdbId}&mediaType=${mediaType}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { videos?: TmdbVideo[] };
      return data.videos ?? [];
    },
    enabled: !!tmdbId && !!mediaType,
    staleTime: 30 * 60 * 1000,
  });
}
