import { useMemo } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  byEpisodeNumber,
  groupOfflineEntries,
  groupSeasonsBySeries,
  localSeriesItem,
  pickSeriesPlayTarget,
  type OfflineSeriesGroup,
} from "@tentacle-tv/offline-core";
import type { DownloadEntry } from "../api";
import { useDownloadsRootReady } from "../localFiles";
import { useDownloadsListState } from "../useDownloadState";
import { useFirstLocalImage } from "./useFirstLocalImage";
import { useLocalJson } from "./useLocalJson";

type People = NonNullable<MediaItem["People"]>;

const NO_PEOPLE: People = [];
/** Le décor de la série ; à défaut, la vignette 16:9 de l'épisode porteur. */
const SERIES_BACKDROP = ["backdrop.jpg", "primary.jpg"] as const;
/** L'affiche 2:3 de la série — jamais la vignette d'un épisode, qui s'y rognerait. */
const SERIES_POSTER = ["series-primary.jpg"] as const;
const LOGO = ["logo.png"] as const;

export interface OfflineSeriesData {
  /** Tout est lu — base, snapshots, sondes d'images : une absence est alors réelle. */
  ready: boolean;
  series: OfflineSeriesGroup | null;
  /** Tous ses épisodes gardés, dans l'ordre de diffusion. */
  episodes: DownloadEntry[];
  /** La série en DTO (`localSeriesItem`) : sans le nombre de saisons du serveur. */
  item: MediaItem | null;
  people: People;
  /** L'épisode que vise « Lecture » : l'entamé le plus récent, sinon le premier non vu. */
  playTarget: DownloadEntry | null;
  backdropUrl: string | null;
  posterUrl: string | null;
  logoUrl: string | null;
}

/**
 * La matière de la fiche d'une série gardée sur la machine : son groupe
 * (saisons, épisodes) depuis la base locale, son DTO depuis `series.json` —
 * photographié à côté de chaque épisode —, ses visuels depuis le disque.
 * Aucune requête serveur.
 */
export function useOfflineSeries(seriesKey: string | undefined): OfflineSeriesData {
  const { entries, ready: listReady } = useDownloadsListState();
  const rootReady = useDownloadsRootReady();

  const series = useMemo(() => {
    const complete = entries.filter((entry) => entry.status === "complete");
    const { seasons } = groupOfflineEntries(complete);
    return groupSeasonsBySeries(seasons).find((group) => group.key === seriesKey) ?? null;
  }, [entries, seriesKey]);
  const episodes = useMemo(
    () => (series ? series.seasons.flatMap((season) => season.episodes).sort(byEpisodeNumber) : []),
    [series],
  );

  const visualId = series?.posterItemId;
  const seriesJson = useLocalJson<MediaItem>(visualId, "series.json");
  const sample = useLocalJson<MediaItem>(visualId, "item.json");
  const backdrop = useFirstLocalImage(visualId, SERIES_BACKDROP);
  const poster = useFirstLocalImage(visualId, SERIES_POSTER);
  const logo = useFirstLocalImage(visualId, LOGO);

  const item = useMemo(() => (series ? localSeriesItem(seriesJson.data, series) : null), [series, seriesJson.data]);
  // Le casting de la série (v5), sinon celui de l'épisode porteur — sans
  // photo : rien ne part sur le réseau.
  const people = useMemo<People>(() => {
    const own = seriesJson.data?.People ?? NO_PEOPLE;
    const source = own.length > 0 ? own : (sample.data?.People ?? NO_PEOPLE);
    return source.map((person) => ({ ...person, PrimaryImageTag: undefined }));
  }, [seriesJson.data?.People, sample.data?.People]);
  const playTarget = useMemo(() => pickSeriesPlayTarget(episodes), [episodes]);

  const settled = !rootReady || (
    seriesJson.settled && sample.settled && backdrop.settled && poster.settled && logo.settled
  );

  return {
    ready: listReady && (series === null || settled),
    series,
    episodes,
    item,
    people,
    playTarget,
    backdropUrl: backdrop.url,
    posterUrl: poster.url,
    logoUrl: logo.url,
  };
}
