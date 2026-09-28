import { memo } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatEpisodeCode, type SearchMediaItem } from "@tentacle-tv/shared";
import { CardStatusMarkers } from "../../../components/cards/CardStatusMarkers";
import { cardProgress } from "../../cards/cardProgress";
import { useOpenCardSheet } from "../../cards/cardSheet";
import { ProgressBar } from "../../ui/ProgressBar";
import { useLongPress } from "../../ui/useLongPress";
import { asMediaItem } from "./SearchSection";

const WATCHED_ONLY = ["watched"] as const;

/**
 * `EpisodeList` de l'app : une ligne par épisode (72 de haut au moins, 4
 * entre elles) — vignette 112 × 63 rayon 8 (sinon l'affiche de la série),
 * série 14 semi-gras, « S01E02 · Titre » 13 secondaire sur deux lignes.
 *
 * Les marques de toutes les cartes sur la vignette : la pastille « vu », ou
 * la barre de progression commune. L'appui long ouvre la feuille de
 * l'épisode, en vignette 16:9 (sa note est celle de l'épisode).
 */
export const EpisodeList = memo(function EpisodeList({ episodes, onOpen }: {
  episodes: SearchMediaItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-4">
      {episodes.map((episode) => (
        <EpisodeLine key={episode.Id} episode={episode} onOpen={onOpen} />
      ))}
    </div>
  );
});

function EpisodeLine({ episode, onOpen }: { episode: SearchMediaItem; onOpen: (id: string) => void }) {
  const client = useJellyfinClient();
  const openSheet = useOpenCardSheet();
  const press = useLongPress(
    openSheet ? () => openSheet({ kind: "media", variant: "landscape", item: asMediaItem(episode) }) : undefined,
  );
  const thumb = episode.ImageTags?.Primary
    ? client.getImageUrl(episode.Id, "Primary", { width: 320, quality: 80 })
    : episode.SeriesId && episode.SeriesPrimaryImageTag
      ? client.getImageUrl(episode.SeriesId, "Primary", { height: 200, quality: 80 })
      : null;
  const code = formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber, { style: "padded" });
  const played = episode.UserData?.Played === true;
  const progress = cardProgress(episode.UserData);

  return (
    <button
      type="button"
      {...press.handlers}
      onClick={() => {
        if (!press.consumeClick()) onOpen(episode.Id);
      }}
      aria-label={`${episode.SeriesName ?? ""} ${code} ${episode.Name}`}
      className="flex min-h-[72px] select-none items-center gap-3 py-1 text-left active:opacity-70"
      style={{ WebkitTapHighlightColor: "transparent", WebkitTouchCallout: "none" }}
    >
      <span className="relative h-[63px] w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2">
        {thumb && <img src={thumb} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
        {played ? (
          <CardStatusMarkers statuses={WATCHED_ONLY} className="right-1 top-1" />
        ) : (
          progress !== null && <ProgressBar progress={progress} className="absolute inset-x-0 bottom-0" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-content-primary">{episode.SeriesName}</span>
        <span className="line-clamp-2 text-[13px] leading-[17px] text-content-secondary">{`${code} · ${episode.Name}`}</span>
      </span>
    </button>
  );
}
