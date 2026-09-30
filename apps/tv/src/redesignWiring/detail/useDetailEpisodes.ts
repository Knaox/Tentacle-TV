import { useCallback, useMemo } from "react";
import { useJellyfinClient, useSeasonBrowser } from "@tentacle-tv/api-client";
import { formatDuration, type MediaItem, type NextEpisodeResult } from "@tentacle-tv/shared";
import type { EpisodeBadge, EpisodeModel, EpisodesModel } from "../../redesign/screens/detail/detailTypes";
import { paletteOfItem } from "../cards/cardModels";
import { episodeStillUri } from "./detailImages";
import { plainText, progressOf } from "./detailModels";

/**
 * Les saisons et les épisodes de la fiche (série, ou série d'un épisode) —
 * la mécanique commune `useSeasonBrowser` :
 * - fiche d'une SÉRIE : la saison de l'épisode à reprendre, ATTENDUE (pas de
 *   saison provisoire : une liste qui changerait sous le focus le perdrait) ;
 * - fiche d'un ÉPISODE : sa saison, lui-même « Épisode actuel ».
 * Sans les sources : la vignette refondue n'a pas de pastilles de qualité, et
 * une longue saison pèse dix fois plus avec (cf. `useSeasonEpisodeList`).
 *
 * Le badge suit le banc : l'épisode ouvert est « actuel » ; sur une série,
 * celui de l'état de visionnage est « Reprendre » s'il est entamé, sinon « À
 * suivre ».
 */

export interface DetailEpisodes {
  /** `null` : pas de section (film, collection) ou série sans saison. */
  model: EpisodesModel | null;
  select: (seasonId: string) => void;
  prefetch: (seasonId: string) => void;
  /** L'épisode Jellyfin d'une vignette : la lecture, la feuille de l'appui long. */
  episodeOf: (episodeId: string) => MediaItem | undefined;
}

export function useDetailEpisodes(item: MediaItem | undefined, watch: NextEpisodeResult | undefined): DetailEpisodes {
  const client = useJellyfinClient();
  const isSeries = item?.Type === "Series";
  const isEpisode = item?.Type === "Episode";
  const seriesId = isSeries ? item?.Id : isEpisode ? item?.SeriesId : undefined;
  const openedSeasonId = isEpisode ? item?.SeasonId : undefined;

  const browser = useSeasonBrowser({
    seriesId,
    preferredSeasonId: openedSeasonId,
    followResume: isSeries,
    currentEpisodeSeasonId: openedSeasonId,
    sources: false,
    provisional: false,
  });

  const followed = isSeries && watch && watch.type !== "completed" ? watch.episode.Id : undefined;
  const highlightId = isEpisode ? item?.Id : followed;
  const { seasons, episodes, selectedSeasonId, markedSeasonId } = browser;

  const models = useMemo<EpisodeModel[] | null>(() => {
    if (!episodes) return null;
    const badgeOf = (episode: MediaItem): EpisodeBadge | null => {
      if (episode.Id !== highlightId) return null;
      if (isEpisode) return "current";
      return (episode.UserData?.PlaybackPositionTicks ?? 0) > 0 ? "resume" : "upNext";
    };
    return episodes.map((episode) => ({
      id: episode.Id,
      number: episode.IndexNumber ?? undefined,
      title: episode.Name ?? "",
      imageUri: episodeStillUri(client, episode),
      meta: formatDuration(episode.RunTimeTicks) ?? undefined,
      overview: plainText(episode.Overview),
      progress: progressOf(episode),
      watched: episode.UserData?.Played === true,
      badge: badgeOf(episode),
      palette: paletteOfItem(episode),
    }));
  }, [episodes, client, highlightId, isEpisode]);

  const model = useMemo<EpisodesModel | null>(() => {
    if (!seriesId) return null;
    // Les saisons se chargent : la section est là, en vignettes fantômes — rien ne saute.
    if (!seasons) return { seasons: [], episodes: null };
    if (seasons.length === 0) return null;
    const anchor = models && highlightId ? models.findIndex((episode) => episode.id === highlightId) : -1;
    return {
      seasons: seasons.map((season) => ({
        id: season.Id,
        label: season.Name ?? "",
        episodeCount: season.RecursiveItemCount ?? season.ChildCount ?? undefined,
        state: season.Id === markedSeasonId ? "current" : season.UserData?.Played ? "watched" : null,
      })),
      selectedSeasonId,
      episodes: models,
      anchorIndex: Math.max(0, anchor),
    };
  }, [seriesId, seasons, models, highlightId, selectedSeasonId, markedSeasonId]);

  const episodeOf = useCallback((episodeId: string) => episodes?.find((episode) => episode.Id === episodeId), [episodes]);

  return { model, select: browser.select, prefetch: browser.prefetch, episodeOf };
}
