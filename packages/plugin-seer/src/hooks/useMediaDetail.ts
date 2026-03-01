import { useQuery } from "@tanstack/react-query";
import { getMovieDetail, getTvDetail } from "../api/seer-client";
import type { MediaType, SeerrMovieDetail, SeerrTvDetail } from "../api/types";

export function useMediaDetail(mediaType: MediaType, tmdbId: number) {
  return useQuery<SeerrMovieDetail | SeerrTvDetail>({
    queryKey: ["seer-media-detail", mediaType, tmdbId],
    queryFn: () => (mediaType === "movie" ? getMovieDetail(tmdbId) : getTvDetail(tmdbId)),
    enabled: tmdbId > 0,
    staleTime: 24 * 60 * 60_000,
  });
}
