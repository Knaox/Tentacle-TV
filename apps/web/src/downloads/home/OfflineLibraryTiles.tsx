import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  groupWatchState,
  isInProgress,
  localMediaItem,
  localSeriesItem,
  pickSeriesPlayTarget,
  seasonLabel,
  watchStateOf,
  type DownloadListEntry,
  type OfflineSeriesGroup,
} from "@tentacle-tv/offline-core";
import { OfflinePosterCard } from "../OfflinePosterCard";
import { useDownloadsRootReady } from "../localFiles";
import { useLocalSnapshot } from "../useLocalSnapshot";
import { useOfflineWatchedToggle } from "../detail/useOfflineActions";
import { seriesPlayAction } from "../detail/seriesPlayAction";

const MOVIE_ART = ["primary.jpg"] as const;
/** L'affiche de la série ; à défaut (transfert hérité) la vignette de l'épisode, plutôt que rien. */
const SERIES_ART = ["series-primary.jpg", "primary.jpg"] as const;

/**
 * L'affiche d'un film gardé. Un composant plutôt qu'un appel dans le `.map()` :
 * sa note et ses puces se lisent dans le snapshot du disque, donc par un hook.
 */
export const OfflineMovieTile = memo(function OfflineMovieTile({ entry }: { entry: DownloadListEntry }) {
  const navigate = useNavigate();
  const toggleWatched = useOfflineWatchedToggle();
  const rootReady = useDownloadsRootReady();
  const snapshot = useLocalSnapshot<MediaItem>(entry.itemId, "item.json", rootReady);
  const item = useMemo(() => localMediaItem(snapshot, entry), [snapshot, entry]);
  const { watched, percent } = watchStateOf(entry);
  const title = entry.title ?? item.Name ?? entry.itemId;

  return (
    <OfflinePosterCard
      title={title}
      subtitle={item.ProductionYear ? String(item.ProductionYear) : null}
      imageItemId={entry.itemId}
      imageCandidates={MOVIE_ART}
      item={item}
      rating={snapshot?.CommunityRating ?? null}
      watched={watched}
      percent={percent}
      play={{ resume: isInProgress(entry), onPlay: () => navigate(`/watch/${entry.itemId}`) }}
      onOpen={() => navigate(`/offline/item/${entry.itemId}`)}
      onToggleWatched={() => void toggleWatched([entry.itemId], !entry.played)}
    />
  );
});

/**
 * L'affiche d'une série gardée : sa note (`series.json`, celle de la série),
 * « 2 saisons · 14 épisodes », Lecture qui vise l'épisode à reprendre, et la
 * coche « vu » de tous ses épisodes gardés.
 */
export const OfflineSeriesTile = memo(function OfflineSeriesTile({ group }: { group: OfflineSeriesGroup }) {
  const { t } = useTranslation(["downloads", "common"]);
  const navigate = useNavigate();
  const toggleWatched = useOfflineWatchedToggle();
  const rootReady = useDownloadsRootReady();
  const seriesJson = useLocalSnapshot<MediaItem>(group.posterItemId, "series.json", rootReady);
  const item = useMemo(() => localSeriesItem(seriesJson, group), [seriesJson, group]);
  const episodes = useMemo(() => group.seasons.flatMap((season) => season.episodes), [group]);
  const { watched } = groupWatchState(episodes);
  const target = useMemo(() => pickSeriesPlayTarget(episodes), [episodes]);
  const action = seriesPlayAction(t, episodes, target);
  // Une seule saison : son numéro dit plus que « 1 saison ».
  const seasons = group.seasons.length === 1
    ? seasonLabel(t, group.seasons[0].seasonNumber)
    : t("downloads:seasonsCount", { count: group.seasons.length });

  return (
    <OfflinePosterCard
      title={group.seriesName}
      subtitle={`${seasons} · ${t("downloads:episodesCount", { count: group.episodeCount })}`}
      imageItemId={group.posterItemId}
      imageCandidates={SERIES_ART}
      item={item}
      rating={seriesJson?.CommunityRating ?? null}
      watched={watched}
      percent={null}
      play={action && target ? {
        resume: episodes.some((episode) => episode.played || isInProgress(episode)) && !watched,
        label: action.label,
        onPlay: () => navigate(`/watch/${target.itemId}`),
      } : null}
      onOpen={() => navigate(`/offline/series/${encodeURIComponent(group.key)}`)}
      onToggleWatched={() => void toggleWatched(episodes.map((episode) => episode.itemId), !watched)}
    />
  );
});
