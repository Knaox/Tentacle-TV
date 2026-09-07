import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { matchesSearch } from "@tentacle-tv/shared";
import {
  groupOfflineEntries,
  groupSeasonsBySeries,
  pickHeroEntries,
  readLibrariesList,
  seriesGroupMatches,
  type OfflineSeriesGroup,
} from "@tentacle-tv/offline-core";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import type { OfflineEntry } from "@/offline/engineApi";
import { prefsStore } from "@/offline/prefsCache";

/** `"all"`, ou l'identifiant d'une bibliothèque Jellyfin présente sur l'appareil. */
export type OfflineCatalogFilter = string;
export const ALL_LIBRARIES: OfflineCatalogFilter = "all";

export interface OfflineCatalogLibrary {
  id: string;
  /** Le nom Jellyfin porté par le snapshot, sinon le cache des bibliothèques, sinon Films / Séries d'après le contenu. */
  label: string;
/** Œuvres de cette bibliothèque sur l'appareil — ce que la grille montre : une
   *  série compte pour un, quel que soit le nombre d'épisodes gardés. */
  count: number;
}

export interface OfflineCatalogCounts {
  titles: number;
  movies: number;
  series: number;
}

export interface OfflineCatalog {
  movies: OfflineEntry[];
  series: OfflineSeriesGroup[];
  /** Les diapositives du bandeau : reprises, puis nouveautés, une par série (hors recherche). */
  hero: OfflineEntry[];
  /** Les bibliothèques d'origine des titres de l'appareil — les puces du filtre (hors recherche). */
  libraries: OfflineCatalogLibrary[];
  /** Les comptes de l'appareil, avant recherche et filtre. */
  counts: OfflineCatalogCounts;
  /** Au moins un titre lisible pour ce compte, avant recherche et filtre. */
  hasContent: boolean;
  /** La liste locale est hydratée — avant, ni vide ni plein, on attend. */
  ready: boolean;
}

/** Une série vit dans une seule bibliothèque : celle du premier épisode qui la connaît. */
const libraryOf = (group: OfflineSeriesGroup): { id: string; name: string | null } | null => {
  const known = group.seasons.flatMap((season) => season.episodes).find((e) => e.libraryId !== null);
  return known?.libraryId == null ? null : { id: known.libraryId, name: known.libraryName };
};

/**
 * Le catalogue local : les titres COMPLETS du compte, regroupés par série,
 * puis cherchés et filtrés par bibliothèque D'ORIGINE (Films, Séries, Animés…
 * — la vraie bibliothèque Jellyfin, pas le type) ; à côté, ce que l'accueil
 * met en avant (bandeau, comptes), indifférent à la recherche. Un transfert
 * en cours n'y paraît pas — il vit sur l'écran de gestion, le catalogue ne
 * montre que ce qui se lit.
 */
export function useOfflineCatalog(search: string, filter: OfflineCatalogFilter): OfflineCatalog {
  const { t } = useTranslation("downloads");
  const userId = useUserId();
  const { data, isFetched } = useOfflineList(userId);
  const complete = useMemo(() => (data ?? []).filter((e) => e.status === "complete"), [data]);
  const groups = useMemo(() => groupOfflineEntries(complete), [complete]);
  const series = useMemo(() => groupSeasonsBySeries(groups.seasons), [groups.seasons]);

  // La puce compte des ŒUVRES, pas des fichiers : elle surmonte une grille
  // d'affiches, et l'en-tête de cette grille compte déjà les séries. Compter
  // les épisodes affichait « Séries 2 » au-dessus de « Séries 1 », pour une
  // seule affiche. Le résumé de l'appareil, lui, garde son compte de titres :
  // c'est de l'espace disque qu'il parle.
  const libraries = useMemo<OfflineCatalogLibrary[]>(() => {
    const cachedNames = new Map(userId ? readLibrariesList(prefsStore, userId).map((l) => [l.id, l.name] as const) : []);
    interface Tally { works: number; movies: number; name: string | null }
    const tally = new Map<string, Tally>();
    const add = (library: { id: string; name: string | null } | null, isMovie: boolean): void => {
      if (library === null) return;
      const row = tally.get(library.id) ?? { works: 0, movies: 0, name: null };
      row.works += 1;
      if (isMovie) row.movies += 1;
      row.name ??= library.name;
      tally.set(library.id, row);
    };
    for (const movie of groups.movies) {
      add(movie.libraryId === null ? null : { id: movie.libraryId, name: movie.libraryName }, true);
    }
    for (const group of series) add(libraryOf(group), false);
    return [...tally.entries()]
      .map(([id, row]) => ({
        id,
        label: row.name ?? cachedNames.get(id) ?? t(row.movies * 2 > row.works ? "sectionMovies" : "sectionSeries"),
        count: row.works,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [groups.movies, series, userId, t]);

  // Terme brut : c'est le comparateur partagé qui normalise (accents, casse).
  const needle = search.trim();
  const all = filter === ALL_LIBRARIES;
  const movies = useMemo(
    () => groups.movies.filter((m) => (all || m.libraryId === filter) && matchesSearch(m.title ?? "", needle)),
    [groups.movies, all, filter, needle],
  );
  const shownSeries = useMemo(
    () => series.filter((s) => (all || libraryOf(s)?.id === filter) && seriesGroupMatches(s, needle)),
    [series, all, filter, needle],
  );

  const hero = useMemo(() => pickHeroEntries(complete), [complete]);
  const counts = useMemo<OfflineCatalogCounts>(
    () => ({ titles: complete.length, movies: groups.movies.length, series: series.length }),
    [complete.length, groups.movies.length, series.length],
  );

  return { movies, series: shownSeries, hero, libraries, counts, hasContent: complete.length > 0, ready: isFetched };
}
