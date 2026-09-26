import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { useBatchWatchedToggle, useEpisodes, useSeasons } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { EpisodeRow } from "./EpisodeRow";

interface Props {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
  currentEpisodeId?: string;
  initialSeasonId?: string;
}

/**
 * `MobileEpisodeList` de l'app : les pilules de saison, puis la barre de la
 * saison et ses épisodes (24 au-dessus). Les emplacements du hors ligne de
 * l'app (« Toute la saison », bouton par ligne) restent vides : pas de hors
 * ligne dans un navigateur.
 */
export const EpisodeList = memo(function EpisodeList({ seriesId, onPlay, currentEpisodeId, initialSeasonId }: Props) {
  const { data: seasons } = useSeasons(seriesId);
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(undefined);
  const activeSeason = selectedSeason ?? initialSeasonId ?? seasons?.[0]?.Id;

  return (
    <div className="mt-6">
      {seasons && seasons.length > 0 && (
        <SeasonPills seasons={seasons} activeSeasonId={activeSeason} onSelect={setSelectedSeason} />
      )}
      {activeSeason && (
        <SeasonEpisodes seriesId={seriesId} seasonId={activeSeason} onPlay={onPlay} currentEpisodeId={currentEpisodeId} />
      )}
    </div>
  );
});

/**
 * `SeasonPills` de l'app : pilules bordées de 36 de haut, texte 13 moyen
 * tertiaire ; la saison active parle ROSE (fond 15 %, filet 45 %).
 */
function SeasonPills({ seasons, activeSeasonId, onSelect }: {
  seasons: MediaItem[];
  activeSeasonId: string | undefined;
  onSelect: (seasonId: string) => void;
}) {
  return (
    <div role="tablist" className="mirror-no-scrollbar mb-3 flex gap-2 overflow-x-auto overscroll-x-contain px-4">
      {seasons.map((season) => {
        const isActive = activeSeasonId === season.Id;
        return (
          <button
            key={season.Id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(season.Id)}
            className={`flex min-h-9 shrink-0 items-center rounded-full border px-3.5 py-2 text-[13px] tracking-[0.1px] ${
              isActive ? "mirror-detail-accent-text font-semibold" : "border-line-subtle bg-fill-subtle font-medium text-content-tertiary"
            }`}
            style={
              isActive
                ? {
                    background: "rgba(var(--brand-accent-rgb), 0.15)",
                    borderColor: "rgba(var(--brand-accent-rgb), 0.45)",
                  }
                : undefined
            }
          >
            <span className="whitespace-nowrap">{season.Name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** `EpisodeItems` de l'app : 640 au plus, la barre de saison, puis les lignes à 8 d'écart. */
function SeasonEpisodes({ seriesId, seasonId, onPlay, currentEpisodeId }: {
  seriesId: string;
  seasonId: string;
  onPlay: (ep: MediaItem) => void;
  currentEpisodeId?: string;
}) {
  const { data: episodes } = useEpisodes(seriesId, seasonId);
  if (!episodes || episodes.length === 0) return null;
  return (
    <div className="w-full max-w-[640px]">
      <SeasonActionBar seriesId={seriesId} seasonId={seasonId} episodes={episodes} />
      <div className="flex flex-col gap-2 px-4">
        {episodes.map((ep) => (
          <EpisodeRow
            key={ep.Id}
            ep={ep}
            seriesId={seriesId}
            seasonId={seasonId}
            onPlay={onPlay}
            isCurrent={ep.Id === currentEpisodeId}
          />
        ))}
      </div>
    </div>
  );
}

/** `SeasonActionBar` de l'app : la pilule « Saison vue / non vue » (rayon 8, 12 semi-gras). */
function SeasonActionBar({ seriesId, seasonId, episodes }: { seriesId: string; seasonId: string; episodes: MediaItem[] }) {
  const { t } = useTranslation("common");
  const batchCtx = useMemo(() => ({ seriesId, seasonId }), [seriesId, seasonId]);
  const { markWatched, markUnwatched } = useBatchWatchedToggle(batchCtx);
  const allWatched = useMemo(() => episodes.every((ep) => ep.UserData?.Played), [episodes]);
  const episodeIds = useMemo(() => episodes.map((ep) => ep.Id), [episodes]);
  const isBusy = markWatched.isPending || markUnwatched.isPending;

  const handleToggle = useCallback(() => {
    if (allWatched) markUnwatched.mutate(episodeIds);
    else markWatched.mutate(episodeIds);
  }, [allWatched, episodeIds, markWatched, markUnwatched]);

  const Icon = allWatched ? EyeOff : Eye;
  return (
    <div className="mx-4 mb-2.5 flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isBusy}
        className={`flex items-center gap-1.5 rounded-lg bg-fill-subtle px-3 py-2 text-content-tertiary ${isBusy ? "opacity-40" : ""}`}
      >
        <Icon size={14} aria-hidden />
        <span className="text-[12px] font-semibold">{allWatched ? t("markSeasonUnwatched") : t("markSeasonWatched")}</span>
      </button>
    </div>
  );
}
