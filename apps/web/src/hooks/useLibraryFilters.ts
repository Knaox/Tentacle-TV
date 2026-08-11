import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export interface LibraryFilterState {
  genreIds: string[];
  studioIds: string[];
  platformIds: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  statusFilter: string | null;
  isFavorite: boolean;
  sortBy: string;
  sortOrder: string;
}

export const DEFAULT_FILTERS: LibraryFilterState = {
  genreIds: [],
  studioIds: [],
  platformIds: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  statusFilter: null,
  isFavorite: false,
  sortBy: "SortName",
  sortOrder: "Ascending",
};

/** Recherche comprise : tout ce qui restreint la grille tient ici. */
interface LibraryQuery {
  search: string;
  filters: LibraryFilterState;
}

const splitIds = (v: string | null): string[] => (v ? v.split(",").filter(Boolean) : []);

const toggleIn = <T,>(list: T[], id: T): T[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

const toNumber = (v: string | null): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function parseQuery(sp: URLSearchParams): LibraryQuery {
  return {
    search: sp.get("q") ?? "",
    filters: {
      genreIds: splitIds(sp.get("genres")),
      studioIds: splitIds(sp.get("studios")),
      platformIds: splitIds(sp.get("platforms")).map(Number).filter(Number.isFinite),
      yearFrom: toNumber(sp.get("from")),
      yearTo: toNumber(sp.get("to")),
      ratingMin: toNumber(sp.get("rating")),
      statusFilter: sp.get("status"),
      isFavorite: sp.get("fav") === "1",
      sortBy: sp.get("sort") ?? DEFAULT_FILTERS.sortBy,
      sortOrder: sp.get("order") === "desc" ? "Descending" : DEFAULT_FILTERS.sortOrder,
    },
  };
}

/**
 * Seuls les réglages qui S'ÉCARTENT du défaut sont écrits : une bibliothèque
 * sans filtre garde une adresse nue, et l'adresse reste lisible dès qu'on en
 * pose un.
 */
function serializeQuery(q: LibraryQuery, base: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams(base);
  const put = (key: string, value: string | null) => {
    if (value) sp.set(key, value);
    else sp.delete(key);
  };
  const { filters: f } = q;

  put("q", q.search || null);
  put("genres", f.genreIds.join(",") || null);
  put("studios", f.studioIds.join(",") || null);
  put("platforms", f.platformIds.join(",") || null);
  put("from", f.yearFrom != null ? String(f.yearFrom) : null);
  put("to", f.yearTo != null ? String(f.yearTo) : null);
  put("rating", f.ratingMin != null ? String(f.ratingMin) : null);
  put("status", f.statusFilter);
  put("fav", f.isFavorite ? "1" : null);
  put("sort", f.sortBy === DEFAULT_FILTERS.sortBy ? null : f.sortBy);
  put("order", f.sortOrder === "Descending" ? "desc" : null);

  return sp;
}

/**
 * Les filtres de bibliothèque vivent dans l'ADRESSE, pas dans un état local.
 *
 * Ils tenaient dans un `useState` porté par la grille — donc par la route
 * `/library/:id`. Ouvrir une fiche démonte cette route : l'état mourait avec
 * elle, et le retour arrière remontait une grille neuve, tous filtres tombés.
 * On revenait d'un film à une bibliothèque entière, à rebrowser depuis le
 * début. Confié à la barre d'adresse, l'état est restitué par l'historique —
 * c'est exactement ce que le bouton « précédent » promet — et il survit en
 * prime au rechargement et au partage du lien.
 *
 * Chaque réglage REMPLACE l'entrée courante (`replace`) : sans cela, poser
 * cinq filtres empilerait cinq entrées et il faudrait cinq retours pour
 * ressortir de la page.
 */
export function useLibraryFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { search, filters } = useMemo(() => parseQuery(searchParams), [searchParams]);

  // Deux réglages posés dans le MÊME gestionnaire — « Non vus » retire les
  // favoris, par exemple — ne peuvent pas tous deux repartir de l'adresse du
  // rendu courant : le second effacerait le premier. Cette référence porte le
  // dernier état écrit, et se resynchronise sur l'adresse à chaque rendu.
  const latest = useRef<LibraryQuery>({ search, filters });
  useEffect(() => {
    latest.current = { search, filters };
  }, [search, filters]);

  const apply = useCallback(
    (patch: (q: LibraryQuery) => LibraryQuery) => {
      const next = patch(latest.current);
      latest.current = next;
      setSearchParams((prev) => serializeQuery(next, prev), { replace: true });
    },
    [setSearchParams],
  );

  const patchFilters = useCallback(
    (patch: (f: LibraryFilterState) => LibraryFilterState) =>
      apply((q) => ({ ...q, filters: patch(q.filters) })),
    [apply],
  );

  const setSearch = useCallback((v: string) => apply((q) => ({ ...q, search: v })), [apply]);

  const toggleGenre = useCallback(
    (id: string) => patchFilters((f) => ({ ...f, genreIds: toggleIn(f.genreIds, id) })),
    [patchFilters],
  );
  const toggleStudio = useCallback(
    (id: string) => patchFilters((f) => ({ ...f, studioIds: toggleIn(f.studioIds, id) })),
    [patchFilters],
  );
  const togglePlatform = useCallback(
    (id: number) => patchFilters((f) => ({ ...f, platformIds: toggleIn(f.platformIds, id) })),
    [patchFilters],
  );
  const setYearFrom = useCallback((v: number | null) => patchFilters((f) => ({ ...f, yearFrom: v })), [patchFilters]);
  const setYearTo = useCallback((v: number | null) => patchFilters((f) => ({ ...f, yearTo: v })), [patchFilters]);
  const setRatingMin = useCallback((v: number | null) => patchFilters((f) => ({ ...f, ratingMin: v })), [patchFilters]);
  const setStatusFilter = useCallback((v: string | null) => patchFilters((f) => ({ ...f, statusFilter: v })), [patchFilters]);
  const setIsFavorite = useCallback((v: boolean) => patchFilters((f) => ({ ...f, isFavorite: v })), [patchFilters]);
  const setSortBy = useCallback((v: string) => patchFilters((f) => ({ ...f, sortBy: v })), [patchFilters]);
  const setSortOrder = useCallback((v: string) => patchFilters((f) => ({ ...f, sortOrder: v })), [patchFilters]);
  const clearYears = useCallback(() => patchFilters((f) => ({ ...f, yearFrom: null, yearTo: null })), [patchFilters]);
  const clearRating = useCallback(() => patchFilters((f) => ({ ...f, ratingMin: null })), [patchFilters]);

  // « Réinitialiser » ne touche pas la recherche : le champ reste sous les
  // yeux, avec son propre moyen de se vider.
  const resetFilters = useCallback(() => patchFilters(() => DEFAULT_FILTERS), [patchFilters]);

  const activeCount = useMemo(() => {
    let c = 0;
    if (filters.genreIds.length > 0) c++;
    if (filters.studioIds.length > 0) c++;
    if (filters.platformIds.length > 0) c++;
    if (filters.yearFrom != null || filters.yearTo != null) c++;
    if (filters.ratingMin != null) c++;
    if (filters.statusFilter) c++;
    if (filters.isFavorite) c++;
    return c;
  }, [filters]);

  return {
    filters, search, setSearch,
    toggleGenre, toggleStudio, togglePlatform, setYearFrom, setYearTo,
    setRatingMin, setStatusFilter, setIsFavorite, setSortBy, setSortOrder,
    resetFilters, clearYears, clearRating, activeCount, hasActiveFilters: activeCount > 0,
    /** Signature stable de l'état courant — de quoi distinguer un vrai
     *  changement de filtre d'un simple remontage de la grille. */
    queryKey: searchParams.toString(),
  };
}
