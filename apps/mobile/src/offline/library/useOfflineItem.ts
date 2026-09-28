import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { byEpisodeNumber, localMediaItem, seasonKeyOf, seasonLabel, seriesKeyOf } from "@tentacle-tv/offline-core";
import { useItemOfflineState, useOfflineList } from "@/hooks/offline/useOfflineList";
import { useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";
import type { OfflineEntry } from "@/offline/engineApi";

const NO_ENTRIES: OfflineEntry[] = [];
const EMPTY_GENRES: string[] = [];

export interface OfflineItem {
  entry: OfflineEntry | null;
  /**
   * Le DTO du FICHIER (`localMediaItem`) : le snapshot, ses flux réécrits à la
   * vérité de la version gardée, la progression locale — `null` sans entrée.
   */
  item: MediaItem | null;
  /** Les épisodes de la même saison sur l'appareil, celui-ci compris, dans l'ordre. */
  siblings: OfflineEntry[];
  seriesKey: string | null;
  seasonKey: string | null;
  seasonName: string;
  /** Le casting sans photo : l'initiale suffit, et zéro réseau. */
  people: NonNullable<MediaItem["People"]>;
  /** Les genres du titre, sinon ceux de sa série. */
  genres: string[];
  isFetched: boolean;
  userId: string | null;
}

/**
 * La matière de la fiche locale d'un titre : le meilleur fichier du compte
 * (complet d'abord), le DTO du snapshot réécrit à la vérité du fichier, les
 * épisodes frères de la saison et les clés qui remontent à la série. Tout
 * vient de la base et du disque.
 */
export function useOfflineItem(itemId: string): OfflineItem {
  const { t } = useTranslation(["downloads"]);
  const userId = useUserId();
  const { data: entry, isFetched } = useItemOfflineState(itemId);
  const { data: list } = useOfflineList(userId);
  const { data: snapshot } = useLocalSnapshotJson<MediaItem>(itemId, "item.json");
  // Un épisode ne porte souvent ni genres ni casting : ceux de sa série, photographiés à côté.
  const { data: seriesJson } = useLocalSnapshotJson<MediaItem>(entry?.kind === "episode" ? itemId : undefined, "series.json");

  const item = useMemo(() => (entry ? localMediaItem(snapshot, entry) : null), [entry, snapshot]);
  const siblings = useMemo(() => {
    if (!entry || entry.kind !== "episode") return NO_ENTRIES;
    const key = seasonKeyOf(entry);
    return (list ?? [])
      .filter((candidate) => candidate.status === "complete" && candidate.kind === "episode" && seasonKeyOf(candidate) === key)
      .sort(byEpisodeNumber);
  }, [entry, list]);
  const people = useMemo(() => {
    const own = snapshot?.People ?? [];
    const source = own.length > 0 ? own : (seriesJson?.People ?? []);
    return source.map((person) => ({ ...person, PrimaryImageTag: undefined }));
  }, [snapshot?.People, seriesJson?.People]);
  const genres = useMemo(() => {
    const own = snapshot?.Genres ?? [];
    return own.length > 0 ? own : (seriesJson?.Genres ?? EMPTY_GENRES);
  }, [snapshot?.Genres, seriesJson?.Genres]);

  return {
    entry: entry ?? null,
    item,
    siblings,
    seriesKey: entry?.kind === "episode" ? seriesKeyOf(entry) : null,
    seasonKey: entry?.kind === "episode" ? seasonKeyOf(entry) : null,
    seasonName: entry ? seasonLabel(t, entry.parentIndexNumber) : "",
    people,
    genres,
    isFetched,
    userId,
  };
}
