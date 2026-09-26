import { memo } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatEpisodeCode, type SearchMediaItem } from "@tentacle-tv/shared";

/**
 * `EpisodeList` de l'app : une ligne par épisode (72 de haut au moins, 4
 * entre elles) — vignette 112 × 63 rayon 8 (sinon l'affiche de la série),
 * barre de progression 3 au pied, série 14 semi-gras, « S01E02 · Titre » 13
 * secondaire sur deux lignes.
 */
export const EpisodeList = memo(function EpisodeList({ episodes, onOpen }: {
  episodes: SearchMediaItem[];
  onOpen: (id: string) => void;
}) {
  const client = useJellyfinClient();
  return (
    <div className="flex flex-col gap-1 px-4">
      {episodes.map((episode) => {
        const thumb = episode.ImageTags?.Primary
          ? client.getImageUrl(episode.Id, "Primary", { width: 320, quality: 80 })
          : episode.SeriesId && episode.SeriesPrimaryImageTag
            ? client.getImageUrl(episode.SeriesId, "Primary", { height: 200, quality: 80 })
            : null;
        const code = formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber, { style: "padded" });
        const progress = episode.UserData?.PlayedPercentage ?? 0;
        return (
          <button
            key={episode.Id}
            type="button"
            onClick={() => onOpen(episode.Id)}
            aria-label={`${episode.SeriesName ?? ""} ${code} ${episode.Name}`}
            className="flex min-h-[72px] items-center gap-3 py-1 text-left active:opacity-70"
          >
            <span className="relative h-[63px] w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {thumb && <img src={thumb} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
              {progress > 0 && progress < 100 && (
                <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: "rgba(var(--scrim-media-rgb), 0.5)" }}>
                  <span className="block h-[3px]" style={{ width: `${progress}%`, background: "var(--brand)" }} />
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-content-primary">{episode.SeriesName}</span>
              <span className="line-clamp-2 text-[13px] leading-[17px] text-content-secondary">{`${code} · ${episode.Name}`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
});
