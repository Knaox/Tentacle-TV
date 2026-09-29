import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { useBatchWatchedToggle, useSeasonBrowser } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { EpisodeRow } from "./EpisodeRow";
import { SeasonTabs } from "../../../components/episodes/SeasonTabs";

interface Props {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
  currentEpisodeId?: string;
  initialSeasonId?: string;
  /** Fiche d'une SÉRIE : la liste s'ouvre sur la saison de l'épisode à reprendre. */
  followResume?: boolean;
}

/**
 * `MobileEpisodeList` de l'app : les pastilles de saison, puis la barre de la
 * saison et ses épisodes (24 au-dessus). Les emplacements du hors ligne de
 * l'app (« Toute la saison », bouton par ligne) restent vides : pas de hors
 * ligne dans un navigateur.
 *
 * La mécanique est celle du bureau (`useSeasonBrowser`) : la saison en cours
 * d'emblée, liste légère puis sources, voisines préchargées. La bande aussi
 * (`SeasonTabs`) : au doigt, les pastilles montent à 44 px.
 */
export const EpisodeList = memo(function EpisodeList({ seriesId, onPlay, currentEpisodeId, initialSeasonId, followResume = false }: Props) {
  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: initialSeasonId,
    followResume,
    currentEpisodeSeasonId: currentEpisodeId ? initialSeasonId : undefined,
  });
  const { seasons, selectedSeasonId, episodes } = browser;

  return (
    <div className="mt-6">
      {seasons && seasons.length > 0 && (
        <SeasonTabs
          seasons={seasons}
          selectedId={selectedSeasonId}
          markedId={browser.markedSeasonId}
          onSelect={browser.select}
          onIntent={browser.prefetch}
          className="mb-3"
          stripClassName="px-4"
        />
      )}
      {selectedSeasonId && episodes && episodes.length > 0 && (
        <SeasonEpisodes seriesId={seriesId} seasonId={selectedSeasonId} episodes={episodes} onPlay={onPlay} currentEpisodeId={currentEpisodeId} />
      )}
    </div>
  );
});

/** `EpisodeItems` de l'app : 640 au plus, la barre de saison, puis les lignes à 8 d'écart. */
function SeasonEpisodes({ seriesId, seasonId, episodes, onPlay, currentEpisodeId }: {
  seriesId: string;
  seasonId: string;
  episodes: MediaItem[];
  onPlay: (ep: MediaItem) => void;
  currentEpisodeId?: string;
}) {
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
