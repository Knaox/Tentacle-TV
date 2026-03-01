import { useMediaDetail } from "../hooks/useMediaDetail";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { SeriesSeasonPicker } from "./SeriesSeasonPicker";
import { posterUrl, backdropUrl, mediaTitle, mediaYear } from "../utils/media-helpers";
import type { SeerrSearchResult, SeerrTvDetail } from "../api/types";

interface MediaDetailModalProps {
  item: SeerrSearchResult;
  onClose: () => void;
  onRequest: (item: SeerrSearchResult) => void;
  requesting: boolean;
}

export function MediaDetailModal({ item, onClose, onRequest, requesting }: MediaDetailModalProps) {
  const mediaType = item.mediaType === "movie" ? "movie" as const : "tv" as const;
  const { data: detail, isLoading } = useMediaDetail(mediaType, item.id);
  const requestMedia = useRequestMedia();
  const title = mediaTitle(item);
  const year = mediaYear(item);
  const backdrop = backdropUrl(item.backdropPath);
  const poster = posterUrl(item.posterPath);

  const handleSeasonRequest = (seasons: number[]) => {
    requestMedia.mutate({
      mediaType: "tv",
      tmdbId: item.id,
      title: title,
      posterPath: item.posterPath ?? undefined,
      seasons,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[#12121a] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Backdrop */}
        {backdrop && (
          <div className="relative h-48 w-full overflow-hidden rounded-t-2xl sm:h-56">
            <img src={backdrop} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12121a] via-transparent" />
          </div>
        )}

        <div className="flex gap-4 px-5 pb-6" style={{ marginTop: backdrop ? -40 : 20 }}>
          {/* Poster */}
          {poster && (
            <img
              src={poster}
              alt={title}
              className="relative h-36 w-24 flex-shrink-0 rounded-xl object-cover shadow-xl"
            />
          )}

          <div className="min-w-0 flex-1 pt-2">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="mt-0.5 text-sm text-white/40">
              {year} {item.mediaType === "movie" ? "Film" : "Serie"}
            </p>
            {item.overview && (
              <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-white/50">
                {item.overview}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/60 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action section */}
        <div className="px-5 pb-6">
          {item.mediaType === "movie" && (
            <button
              onClick={() => onRequest(item)}
              disabled={requesting}
              className="w-full rounded-lg bg-purple-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
            >
              {requesting ? "Envoi de la demande..." : "Demander ce film"}
            </button>
          )}

          {item.mediaType === "tv" && !isLoading && detail && "seasons" in detail && (
            <SeriesSeasonPicker
              seasons={(detail as SeerrTvDetail).seasons ?? []}
              onRequest={handleSeasonRequest}
              requesting={requestMedia.isPending}
            />
          )}

          {isLoading && item.mediaType === "tv" && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
