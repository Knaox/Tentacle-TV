import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { mergeTrailers, type MediaItem, type RichTrailer, type TmdbVideo } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "./usePreferences";

/** Ce qu'un titre dit de ses bandes-annonces distantes. */
export type RemoteTrailersOwner = Pick<MediaItem, "Type" | "ProviderIds" | "RemoteTrailers">;

const TMDB_TRAILERS_STALE_TIME = 30 * 60_000;

/**
 * Le type TMDB d'un titre. Un épisode n'en a pas : son `ProviderIds.Tmdb` est
 * celui de l'ÉPISODE, et `/tv/{id}` y aurait trouvé une autre série — Jellyfin
 * seul, comme sur le web (la TV native le demandait quand même).
 */
export function tmdbMediaType(type: MediaItem["Type"] | undefined): "movie" | "tv" | undefined {
  if (type === "Movie") return "movie";
  return type === "Series" ? "tv" : undefined;
}

/** La liste TMDB du backend (via Jellyseerr) ; vide sans Jellyseerr, sans session ou en erreur. */
async function fetchTmdbTrailers(tmdbId: string, mediaType: "movie" | "tv"): Promise<TmdbVideo[]> {
  try {
    const data = await tentacleApiFetch<{ videos?: TmdbVideo[] }>(
      `/api/tmdb/trailers?tmdbId=${encodeURIComponent(tmdbId)}&mediaType=${mediaType}`,
    );
    return data.videos ?? [];
  } catch {
    return [];
  }
}

/**
 * Les bandes-annonces DISTANTES d'un titre : celles de Jellyfin
 * (`RemoteTrailers`) et la liste complète TMDB que sert le backend,
 * dédupliquées par vidéo YouTube et triées pour la langue de l'app (la VF
 * d'abord en français). Sans Jellyseerr, celles de Jellyfin seules.
 *
 * Une seule écriture pour le web, le bureau, le miroir, le mobile, les
 * téléviseurs natifs et la LG ; la clé `tmdb-trailers` est celle que le web et
 * la TV partageaient déjà.
 */
export function useRemoteTrailers(owner: RemoteTrailersOwner | undefined, lang: string | undefined): RichTrailer[] {
  return useRemoteTrailersState(owner, lang).trailers;
}

/**
 * Les mêmes, avec de quoi savoir que la liste TMDB a répondu (`settled`) —
 * pour ne rien conclure de leur absence tant qu'elle est en route.
 */
export function useRemoteTrailersState(
  owner: RemoteTrailersOwner | undefined,
  lang: string | undefined,
): { trailers: RichTrailer[]; settled: boolean } {
  const tmdbId = owner?.ProviderIds?.Tmdb;
  const mediaType = tmdbMediaType(owner?.Type);
  const enabled = !!tmdbId && !!mediaType;
  const query = useQuery({
    queryKey: ["tmdb-trailers", tmdbId, mediaType],
    queryFn: () => fetchTmdbTrailers(tmdbId!, mediaType!),
    enabled,
    staleTime: TMDB_TRAILERS_STALE_TIME,
  });
  const tmdb = query.data;
  const jellyfin = owner?.RemoteTrailers;
  const trailers = useMemo(
    () => mergeTrailers((jellyfin ?? []).filter((trailer) => !!trailer.Url), tmdb ?? [], lang),
    [jellyfin, tmdb, lang],
  );
  return { trailers, settled: !!owner && (!enabled || query.isSuccess || query.isError) };
}
