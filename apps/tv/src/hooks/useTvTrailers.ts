import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import {
  mergeTrailers,
  type MediaItem,
  type RichTrailer,
  type TmdbVideo,
} from "@tentacle-tv/shared";

/**
 * Bandes-annonces d'un média — STRICTEMENT comme MediaDetail (web) :
 * RemoteTrailers Jellyfin (déjà présents sur l'item via useMediaItem) fusionnés
 * avec les vidéos TMDB (`/api/tmdb/trailers`, source Jellyseerr), dédupliqués
 * par ID YouTube et triés selon la langue d'interface (VF d'abord en profil FR
 * — la langue vient des préférences serveur, donc de la DB Tentacle).
 */
export function useTvTrailers(item: MediaItem | undefined): RichTrailer[] {
  const { i18n } = useTranslation();
  const { storage } = useTentacleConfig();
  const lang = i18n.language;

  const tmdbId = item?.ProviderIds?.Tmdb;
  const mediaType = item?.Type === "Movie" ? "movie" : "tv";

  const { data: tmdbVideos } = useQuery<TmdbVideo[]>({
    queryKey: ["tmdb-trailers", tmdbId, mediaType],
    queryFn: async () => {
      const serverUrl = storage.getItem("tentacle_server_url") ?? "";
      const token = storage.getItem("tentacle_token") ?? "";
      if (!serverUrl || !token || !tmdbId) return [];
      try {
        const res = await fetch(
          `${serverUrl}/api/tmdb/trailers?tmdbId=${tmdbId}&mediaType=${mediaType}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return [];
        const data = (await res.json()) as { videos?: TmdbVideo[] };
        return data.videos ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!tmdbId,
    staleTime: 30 * 60_000,
  });

  const jellyfinTrailers = (item?.RemoteTrailers ?? []).filter(
    (tr): tr is { Url: string; Name?: string } => !!tr.Url,
  );

  return mergeTrailers(jellyfinTrailers, tmdbVideos ?? [], lang);
}
