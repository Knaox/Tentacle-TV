import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "../api/types";
import { posterUrl, mediaTitle, mediaYear, mediaTypeKey } from "../utils/media-helpers";

interface MediaCardProps {
  item: SeerrSearchResult;
  onRequest?: (item: SeerrSearchResult) => void;
  onClick?: (item: SeerrSearchResult) => void;
  requesting?: boolean;
}

export function MediaCard({ item, onRequest, onClick, requesting }: MediaCardProps) {
  const { t } = useTranslation("seer");
  const title = mediaTitle(item) || t("seer:untitled");
  const year = mediaYear(item);
  const type = t(mediaTypeKey(item));
  const poster = posterUrl(item.posterPath);
  const hasMediaInfo = item.mediaInfo && item.mediaInfo.status > 1;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl bg-white/5 transition-all duration-300 hover:bg-white/10 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10"
      onClick={() => onClick?.(item)}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/20 text-sm">
            {t("seer:noImage")}
          </div>
        )}

        {/* Type badge */}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
          {type}
        </span>

        {/* Rating */}
        {item.voteAverage != null && item.voteAverage > 0 && (
          <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 backdrop-blur-sm">
            {item.voteAverage.toFixed(1)}
          </span>
        )}

        {/* Hover overlay with request button */}
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {item.mediaType === "movie" && !hasMediaInfo && onRequest && (
            <button
              onClick={(e) => { e.stopPropagation(); onRequest(item); }}
              disabled={requesting}
              className="m-3 w-full rounded-lg bg-purple-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
            >
              {requesting ? t("seer:sending") : t("seer:request")}
            </button>
          )}
          {item.mediaType === "tv" && !hasMediaInfo && (
            <div className="m-3 w-full rounded-lg bg-purple-600/80 py-2 text-center text-xs font-semibold text-white">
              {t("seer:viewSeasons")}
            </div>
          )}
          {hasMediaInfo && (
            <div className="m-3 w-full rounded-lg bg-emerald-600/80 py-2 text-center text-xs font-semibold text-white">
              {t("seer:alreadyRequested")}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
        {year && <p className="text-xs text-white/40">{year}</p>}
      </div>
    </div>
  );
}
