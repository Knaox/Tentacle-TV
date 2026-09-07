import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  groupOfflineEntries,
  groupSeasonsBySeries,
  groupWatchState,
  pickSeriesPlayTarget,
  seasonLabel,
  type OfflineSeasonGroup,
  type OfflineSeriesGroup,
} from "@tentacle-tv/offline-core";
import { buildSeriesPlayLabel } from "@/components/detail/computeBadges";
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
  /** La série en `MediaItem` (le DTO de `series.json` sous une identité stable). */
  seriesItem: MediaItem;
  /** Le DTO d'un épisode — les `MediaStreams` des jetons de qualité. */
  sampleItem: MediaItem | undefined;
  genres: string[];
  /** Le casting sans photo : l'initiale suffit, et zéro réseau. */
  people: NonNullable<MediaItem["People"]>;
  overview: string;
  playTarget: OfflineEntry | null;
  playLabel: string | null;
  watchedAll: boolean;
  isFetched: boolean;
}

const stripHtml = (text: string | undefined): string => (text ?? "").replace(/<[^>]+>/g, "").trim();

/**
 * La matière de la vue série locale : le groupe (série, saisons, épisodes)
 * depuis la liste locale, les DTO de la série, de la saison et d'un épisode
 * depuis les snapshots — genres et casting sur `series.json` (v5), repli sur
 * l'épisode pour un snapshot plus ancien —, et l'épisode à lire avec son
 * libellé « Reprendre à 12:30 · S01E03 », le même qu'en ligne.
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

  // La saison choisie peut disparaître (dernier épisode retiré) : on retombe
  // sur la première plutôt que sur une page vide.
  const wantedSeason = seasonChoice ?? seasonParam ?? null;
  const season = series?.seasons.find((group) => group.key === wantedSeason) ?? series?.seasons[0] ?? null;
  const episodes = useMemo(() => series?.seasons.flatMap((group) => group.episodes) ?? [], [series]);

  const { data: seriesJson } = useLocalSnapshotJson<MediaItem>(series?.posterItemId, "series.json");
  const { data: seasonJson } = useLocalSnapshotJson<MediaItem>(season?.posterItemId, "season.json");
  const { data: sampleItem } = useLocalSnapshotJson<MediaItem>(series?.posterItemId, "item.json");

  const seriesItem = useMemo<MediaItem>(
    () => ({ ...(seriesJson ?? {}), Id: seriesKey ?? "", Name: series?.seriesName ?? seriesJson?.Name ?? "", Type: "Series" }),
    [seriesJson, seriesKey, series?.seriesName],
  );
  const seasonItems = useMemo<MediaItem[]>(
    () => (series?.seasons ?? []).map((group) => ({ Id: group.key, Name: seasonLabel(t, group.seasonNumber), Type: "Season" }) as MediaItem),
    [series, t],
  );
  const people = useMemo(
    () => (seriesJson?.People ?? sampleItem?.People ?? []).map((person) => ({ ...person, PrimaryImageTag: undefined })),
    [seriesJson?.People, sampleItem?.People],
  );
  const playTarget = useMemo(() => pickSeriesPlayTarget(episodes), [episodes]);
  const playLabel = playTarget
    ? buildSeriesPlayLabel(
        {
          ParentIndexNumber: playTarget.parentIndexNumber,
          IndexNumber: playTarget.indexNumber,
          UserData: { PlaybackPositionTicks: playTarget.played ? 0 : playTarget.positionTicks },
        },
        (key, options) => String(t(`common:${key}`, options)),
      )
    : null;

  return {
    series,
    season,
    selectSeason: setSeasonChoice,
    seasonItems,
    seriesItem,
    sampleItem: sampleItem ?? undefined,
    genres: seriesJson?.Genres ?? sampleItem?.Genres ?? EMPTY_GENRES,
    people,
    overview: stripHtml(seasonJson?.Overview ?? seriesJson?.Overview),
    playTarget,
    playLabel,
    watchedAll: groupWatchState(episodes).watched,
    isFetched,
  };
}
