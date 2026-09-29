import { useTranslation } from "react-i18next";
import { useRemoteTrailers } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { RichTrailer } from "../components/detail/trailerLang";

/**
 * Trailers distants d'un item, fusionnés : RemoteTrailers Jellyfin + liste
 * complète TMDB (Jellyseerr), dédupliqués et triés selon la langue d'interface.
 * Films + séries (les épisodes n'ont pas de tmdbId propre → Jellyfin seul).
 * La logique vit dans l'api-client (`useRemoteTrailers`), commune à toutes
 * les plateformes ; ici, la langue de l'interface web.
 */
export function useItemRemoteTrailers(item: MediaItem): RichTrailer[] {
  const { i18n } = useTranslation();
  return useRemoteTrailers(item, i18n.language);
}
