import { useMemo } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { matchesSearch } from "@tentacle-tv/shared";
import {
  groupOfflineEntries,
  groupSeasonsBySeries,
  seriesGroupMatches,
  type OfflineSeriesGroup,
} from "@tentacle-tv/offline-core";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import type { OfflineEntry } from "@/offline/engineApi";

export type OfflineCatalogFilter = "all" | "movies" | "series";

export interface OfflineCatalog {
  movies: OfflineEntry[];
  series: OfflineSeriesGroup[];
  /** Au moins un titre lisible pour ce compte, avant recherche et filtre. */
  hasContent: boolean;
  /** La liste locale est hydratée — avant, ni vide ni plein, on attend. */
  ready: boolean;
}

/**
 * Le catalogue local : les titres COMPLETS du compte, regroupés par série,
 * puis cherchés et filtrés. Un transfert en cours n'y paraît pas — il vit sur
 * l'écran de gestion, le catalogue ne montre que ce qui se lit.
 */
export function useOfflineCatalog(search: string, filter: OfflineCatalogFilter): OfflineCatalog {
  const userId = useUserId();
  const { data, isFetched } = useOfflineList(userId);
  const complete = useMemo(() => (data ?? []).filter((e) => e.status === "complete"), [data]);
  const groups = useMemo(() => groupOfflineEntries(complete), [complete]);
  const series = useMemo(() => groupSeasonsBySeries(groups.seasons), [groups.seasons]);

  // Terme brut : c'est le comparateur partagé qui normalise (accents, casse).
  const needle = search.trim();
  const movies = useMemo(
    () => (filter === "series" ? [] : groups.movies.filter((m) => matchesSearch(m.title ?? "", needle))),
    [groups.movies, filter, needle],
  );
  const shownSeries = useMemo(
    () => (filter === "movies" ? [] : series.filter((s) => seriesGroupMatches(s, needle))),
    [series, filter, needle],
  );

  return { movies, series: shownSeries, hasContent: complete.length > 0, ready: isFetched };
}
