import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { matchesSearch } from "@tentacle-tv/shared";
import {
  groupOfflineEntries,
  groupSeasonsBySeries,
  pickHeroEntries,
  pickNextUpEntries,
  pickResumeEntries,
  seriesGroupMatches,
  type DownloadListEntry,
  type OfflineSeriesGroup,
} from "@tentacle-tv/offline-core";
import { useDownloadsListState } from "../useDownloadState";

/** `all`, ou l'identifiant de la bibliothèque Jellyfin d'origine. */
export type OfflineHomeFilter = string;
export const ALL_LIBRARIES: OfflineHomeFilter = "all";

export interface OfflineHomeLibrary {
  id: string;
  label: string;
  /** Œuvres de cette bibliothèque sur la machine — une série compte pour un. */
  count: number;
}

export interface OfflineHome {
  /** La base est lue : un catalogue vide l'est alors pour de bon. */
  ready: boolean;
  /** Les titres lisibles du compte (transferts terminés). */
  complete: DownloadListEntry[];
  /** Diapositives de la bannière : reprises, puis derniers arrivés, une par série. */
  hero: DownloadListEntry[];
  resume: DownloadListEntry[];
  nextUp: DownloadListEntry[];
  libraries: OfflineHomeLibrary[];
  /** Films et séries, filtrés (bibliothèque) et cherchés. */
  movies: DownloadListEntry[];
  series: OfflineSeriesGroup[];
}

/** Une série vit dans une seule bibliothèque : celle du premier épisode qui la connaît. */
function libraryOf(group: OfflineSeriesGroup): { id: string; name: string | null } | null {
  const known = group.seasons.flatMap((season) => season.episodes).find((episode) => episode.libraryId !== null);
  return known?.libraryId == null ? null : { id: known.libraryId, name: known.libraryName };
}

/**
 * La matière de l'accueil local : ce que la bannière et les rangées mettent
 * en avant (insensible à la recherche), puis le catalogue — films et séries —
 * filtré par bibliothèque D'ORIGINE (Films, Séries, Animés…) et cherché. Même
 * logique que le téléphone (`useOfflineCatalog`), avec les mots du bureau.
 */
export function useOfflineHome(search: string, filter: OfflineHomeFilter): OfflineHome {
  const { t } = useTranslation("downloads");
  const { entries, ready } = useDownloadsListState();
  const complete = useMemo(() => entries.filter((entry) => entry.status === "complete"), [entries]);
  const groups = useMemo(() => groupOfflineEntries(complete), [complete]);
  const allSeries = useMemo(() => groupSeasonsBySeries(groups.seasons), [groups.seasons]);

  const libraries = useMemo<OfflineHomeLibrary[]>(() => {
    const tally = new Map<string, { works: number; movies: number; name: string | null }>();
    const add = (library: { id: string; name: string | null } | null, isMovie: boolean) => {
      if (library === null) return;
      const row = tally.get(library.id) ?? { works: 0, movies: 0, name: null };
      row.works += 1;
      if (isMovie) row.movies += 1;
      row.name ??= library.name;
      tally.set(library.id, row);
    };
    for (const movie of groups.movies) add(movie.libraryId === null ? null : { id: movie.libraryId, name: movie.libraryName }, true);
    for (const group of allSeries) add(libraryOf(group), false);
    return [...tally.entries()]
      .map(([id, row]) => ({
        id,
        label: row.name ?? t(row.movies * 2 > row.works ? "sectionMovies" : "sectionSeries"),
        count: row.works,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [groups.movies, allSeries, t]);

  // Terme brut : le comparateur partagé normalise lui-même (accents, casse).
  const needle = search.trim();
  const all = filter === ALL_LIBRARIES;
  const movies = useMemo(
    () => groups.movies.filter((movie) => (all || movie.libraryId === filter) && matchesSearch(movie.title ?? "", needle)),
    [groups.movies, all, filter, needle],
  );
  const series = useMemo(
    () => allSeries.filter((group) => (all || libraryOf(group)?.id === filter) && seriesGroupMatches(group, needle)),
    [allSeries, all, filter, needle],
  );

  const hero = useMemo(() => pickHeroEntries(complete, 5), [complete]);
  const resume = useMemo(() => pickResumeEntries(complete, 12), [complete]);
  const nextUp = useMemo(() => pickNextUpEntries(complete, 12), [complete]);

  return { ready, complete, hero, resume, nextUp, libraries, movies, series };
}
