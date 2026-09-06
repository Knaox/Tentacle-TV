import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { byEpisodeNumber, remainingTicks, seasonKeyOf, seasonLabel, seriesKeyOf } from "@tentacle-tv/offline-core";
import { useItemOfflineState, useOfflineList } from "@/hooks/offline/useOfflineList";
import { useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";
import type { OfflineEntry } from "@/offline/engineApi";

const TICKS_PER_MINUTE = 600_000_000;
const NO_ENTRIES: OfflineEntry[] = [];
const EMPTY_GENRES: string[] = [];

export interface OfflineItem {
  entry: OfflineEntry | null;
  item: MediaItem | undefined;
  /** Les épisodes de la même saison sur l'appareil, celui-ci compris, dans l'ordre. */
  siblings: OfflineEntry[];
  seriesKey: string | null;
  seasonKey: string | null;
  seasonName: string;
  /** Le casting sans photo : l'initiale suffit, et zéro réseau. */
  people: NonNullable<MediaItem["People"]>;
  /** Les genres du titre, sinon ceux de sa série. */
  genres: string[];
  remainingMinutes: number;
  isFetched: boolean;
  userId: string | null;
}

/**
 * La matière de la fiche locale d'un titre : le meilleur fichier du compte
 * (complet d'abord), le DTO du snapshot, les épisodes frères de la saison et
 * les clés qui remontent à la série. Tout vient de la base et du disque.
 */
export function useOfflineItem(itemId: string): OfflineItem {
  const { t } = useTranslation(["downloads"]);
  const userId = useUserId();
  const { data: entry, isFetched } = useItemOfflineState(itemId);
  const { data: list } = useOfflineList(userId);
  const { data: item } = useLocalSnapshotJson<MediaItem>(itemId, "item.json");
  // Un épisode ne porte souvent ni genres ni casting : ceux de sa série, photographiés à côté.
  const { data: seriesJson } = useLocalSnapshotJson<MediaItem>(entry?.kind === "episode" ? itemId : undefined, "series.json");

  const siblings = useMemo(() => {
    if (!entry || entry.kind !== "episode") return NO_ENTRIES;
    const key = seasonKeyOf(entry);
    return (list ?? [])
      .filter((candidate) => candidate.status === "complete" && candidate.kind === "episode" && seasonKeyOf(candidate) === key)
      .sort(byEpisodeNumber);
  }, [entry, list]);
  const people = useMemo(() => {
    const own = item?.People ?? [];
    const source = own.length > 0 ? own : (seriesJson?.People ?? []);
    return source.map((person) => ({ ...person, PrimaryImageTag: undefined }));
  }, [item?.People, seriesJson?.People]);
  const genres = useMemo(() => {
    const own = item?.Genres ?? [];
    return own.length > 0 ? own : (seriesJson?.Genres ?? EMPTY_GENRES);
  }, [item?.Genres, seriesJson?.Genres]);

  return {
    entry: entry ?? null,
    item: item ?? undefined,
    siblings,
    seriesKey: entry?.kind === "episode" ? seriesKeyOf(entry) : null,
    seasonKey: entry?.kind === "episode" ? seasonKeyOf(entry) : null,
    seasonName: entry ? seasonLabel(t, entry.parentIndexNumber) : "",
    people,
    genres,
    remainingMinutes: entry ? Math.round(remainingTicks(entry) / TICKS_PER_MINUTE) : 0,
    isFetched,
    userId,
  };
}
