import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTmdbTrailers } from "./useTmdbTrailers";
import { mergeTrailers } from "../components/detail/mergeTrailers";
import type { RichTrailer } from "../components/detail/trailerLang";

/**
 * Trailers distants d'un item, fusionnés : RemoteTrailers Jellyfin + liste
 * complète TMDB (Jellyseerr), dédupliqués et triés selon la langue d'interface.
 * Films + séries (les épisodes n'ont pas de tmdbId propre → Jellyfin seul).
 */
export function useItemRemoteTrailers(item: MediaItem): RichTrailer[] {
  const { i18n } = useTranslation();
  const tmdbId = item.ProviderIds?.Tmdb;
  const mediaType = item.Type === "Movie" ? "movie" : item.Type === "Series" ? "tv" : undefined;
  const { data: tmdb } = useTmdbTrailers(tmdbId, mediaType);

  return useMemo(
    () => mergeTrailers(item.RemoteTrailers ?? [], tmdb ?? [], i18n.language),
    [item.RemoteTrailers, tmdb, i18n.language],
  );
}
