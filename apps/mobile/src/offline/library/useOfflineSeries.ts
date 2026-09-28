import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  byEpisodeNumber,
  groupOfflineEntries,
  groupSeasonsBySeries,
  groupWatchState,
  localSeriesItem,
  pickSeriesPlayTarget,
  seasonLabel,
  type OfflineSeasonGroup,
  type OfflineSeriesGroup,
} from "@tentacle-tv/offline-core";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";
import type { OfflineEntry } from "@/offline/engineApi";

const EMPTY_GENRES: string[] = [];

export interface OfflineSeries {
  series: OfflineSeriesGroup | null;
  season: OfflineSeasonGroup | null;
  selectSeason: (key: string) => void;
  /** Les saisons en `MediaItem` synthétiques, pour `SeasonPills`. */
  seasonItems: MediaItem[];
  /** La série en DTO (`localSeriesItem`) : sans le nombre de saisons du serveur, « vue » quand tout l'est ici. */
  seriesItem: MediaItem;
  /** Tous les épisodes gardés, dans l'ordre de diffusion. */
  episodes: OfflineEntry[];
  genres: string[];
  /** Le casting sans photo : l'initiale suffit, et zéro réseau. */
  people: NonNullable<MediaItem["People"]>;
  overview: string;
  /** L'épisode que vise « Lecture » : l'entamé le plus récent, sinon le premier non vu. */
  playTarget: OfflineEntry | null;
  watchedAll: boolean;
  isFetched: boolean;
}

const stripHtml = (text: string | undefined): string => (text ?? "").replace(/<[^>]+>/g, "").trim();

/**
 * La matière de la fiche locale d'une série : le groupe (série, saisons,
 * épisodes) depuis la liste locale, les DTO de la série, de la saison et d'un
 * épisode depuis les snapshots — genres et casting sur `series.json` (v5),
 * repli sur l'épisode pour un snapshot plus ancien —, et l'épisode à lire.
 */
export function useOfflineSeries(seriesKey: string | undefined, seasonParam: string | undefined): OfflineSeries {
  const { t } = useTranslation(["downloads", "common"]);
  const userId = useUserId();
  const { data, isFetched } = useOfflineList(userId);
  const [seasonChoice, setSeasonChoice] = useState<string | null>(null);

  const series = useMemo(() => {
    const complete = (data ?? []).filter((entry) => entry.status === "complete");
    const { seasons } = groupOfflineEntries(complete);
    return groupSeasonsBySeries(seasons).find((group) => group.key === seriesKey) ?? null;
  }, [data, seriesKey]);
  const episodes = useMemo(
    () => (series ? series.seasons.flatMap((group) => group.episodes).sort(byEpisodeNumber) : []),
    [series],
  );
  const playTarget = useMemo(() => pickSeriesPlayTarget(episodes), [episodes]);

  // La saison choisie peut disparaître (dernier épisode retiré) : on retombe
  // sur celle demandée, puis sur celle de l'épisode à reprendre, puis la première.
  const wanted = seasonChoice ?? seasonParam ?? null;
  const targetSeason = playTarget ? series?.seasons.find((group) => group.episodes.some((e) => e.itemId === playTarget.itemId)) : undefined;
  const season = series?.seasons.find((group) => group.key === wanted) ?? targetSeason ?? series?.seasons[0] ?? null;

  const { data: seriesJson } = useLocalSnapshotJson<MediaItem>(series?.posterItemId, "series.json");
  const { data: seasonJson } = useLocalSnapshotJson<MediaItem>(season?.posterItemId, "season.json");
  const { data: sampleItem } = useLocalSnapshotJson<MediaItem>(series?.posterItemId, "item.json");

  const seriesItem = useMemo<MediaItem>(
    () => (series ? localSeriesItem(seriesJson, series) : { Id: seriesKey ?? "", Name: seriesJson?.Name ?? "", Type: "Series" }),
    [seriesJson, series, seriesKey],
  );
  const seasonItems = useMemo<MediaItem[]>(
    () => (series?.seasons ?? []).map((group) => ({ Id: group.key, Name: seasonLabel(t, group.seasonNumber), Type: "Season" }) as MediaItem),
    [series, t],
  );
  const people = useMemo(
    () => (seriesJson?.People ?? sampleItem?.People ?? []).map((person) => ({ ...person, PrimaryImageTag: undefined })),
    [seriesJson?.People, sampleItem?.People],
  );

  return {
    series,
    season,
    selectSeason: setSeasonChoice,
    seasonItems,
    seriesItem,
    episodes,
    genres: seriesJson?.Genres ?? sampleItem?.Genres ?? EMPTY_GENRES,
    people,
    overview: stripHtml(seasonJson?.Overview ?? seriesJson?.Overview),
    playTarget,
    watchedAll: groupWatchState(episodes).watched,
    isFetched,
  };
}
