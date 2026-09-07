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
  /** Films + séries de cette bibliothèque sur l'appareil. */
  count: number;
  /** `CollectionType` Jellyfin (`movies`, `tvshows`…) — l'icône de la tuile ; `null` si inconnu. */
  type: string | null;
  /** Un titre de la bibliothèque dont la bannière locale illustre la tuile. */
  artItemId: string | null;
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
const libraryOf = (group: OfflineSeriesGroup): string | null =>
  group.seasons.flatMap((season) => season.episodes).find((e) => e.libraryId !== null)?.libraryId ?? null;

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

  const libraries = useMemo<OfflineCatalogLibrary[]>(() => {
    const cachedNames = new Map(userId ? readLibrariesList(prefsStore, userId).map((l) => [l.id, l.name] as const) : []);
    interface Tally { movies: number; series: number; name: string | null; type: string | null; artItemId: string | null }
    const tally = new Map<string, Tally>();
    const bump = (entry: OfflineEntry, key: "movies" | "series") => {
      if (entry.libraryId === null) return;
      const row = tally.get(entry.libraryId) ?? { movies: 0, series: 0, name: null, type: null, artItemId: null };
      row[key] += 1;
      row.name ??= entry.libraryName;
      row.type ??= entry.libraryType;
      row.artItemId ??= entry.itemId;
      tally.set(entry.libraryId, row);
    };
    for (const movie of groups.movies) bump(movie, "movies");
    for (const group of series) {
      const sample = group.seasons.flatMap((season) => season.episodes).find((e) => e.libraryId !== null);
      if (sample) bump(sample, "series");
    }
    return [...tally.entries()]
      .map(([id, row]) => ({
        id,
        label: row.name ?? cachedNames.get(id) ?? t(row.series > row.movies ? "sectionSeries" : "sectionMovies"),
        count: row.movies + row.series,
        type: row.type,
        artItemId: row.artItemId,
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
    () => series.filter((s) => (all || libraryOf(s) === filter) && seriesGroupMatches(s, needle)),
    [series, all, filter, needle],
  );

  const hero = useMemo(() => pickHeroEntries(complete), [complete]);
  const counts = useMemo<OfflineCatalogCounts>(
    () => ({ titles: complete.length, movies: groups.movies.length, series: series.length }),
    [complete.length, groups.movies.length, series.length],
  );

  return { movies, series: shownSeries, hero, libraries, counts, hasContent: complete.length > 0, ready: isFetched };
}
