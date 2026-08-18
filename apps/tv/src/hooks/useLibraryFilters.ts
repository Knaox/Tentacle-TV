import { useCallback, useMemo, useState } from "react";

/**
 * L'état des filtres de bibliothèque — mêmes champs et mêmes défauts que le
 * web (`apps/web/src/hooks/useLibraryFilters.ts`), SANS l'adresse : ici l'état
 * vit dans l'écran, et la pile de navigation native garde l'écran monté quand
 * on ouvre une fiche — le retour retrouve les filtres tels quels, ce que la LG
 * obtient par `filtersMemory` (et qui, comme elle, ne survit pas au
 * redémarrage : c'est voulu).
 */
export interface LibraryFilterState {
  genreIds: string[];
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
  platformIds: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  statusFilter: null,
  isFavorite: false,
  sortBy: "SortName",
  sortOrder: "Ascending",
};

const toggleIn = <T,>(list: T[], id: T): T[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

/** La mémoire de session, PAR bibliothèque — parité `filtersMemory` webOS :
 *  une Map en mémoire JS, jamais persistée. Revenir sur une bibliothèque
 *  retrouve ses filtres, redémarrer l'app les oublie (voulu). */
const memory = new Map<string, LibraryFilterState>();

export function useLibraryFilters(libraryId: string) {
  const [filters, setFilters] = useState<LibraryFilterState>(
    () => memory.get(libraryId) ?? DEFAULT_FILTERS,
  );

  // Changement de bibliothèque (écran réutilisé par navigate) : rejouer la
  // mémoire de la nouvelle, ou repartir des défauts.
  const [lastLibraryId, setLastLibraryId] = useState(libraryId);
  if (libraryId !== lastLibraryId) {
    setLastLibraryId(libraryId);
    setFilters(memory.get(libraryId) ?? DEFAULT_FILTERS);
  }

  const patch = useCallback((p: (f: LibraryFilterState) => LibraryFilterState) => {
    setFilters((f) => {
      const next = p(f);
      memory.set(libraryId, next);
      return next;
    });
  }, [libraryId]);

  const toggleGenre = useCallback((id: string) => patch((f) => ({ ...f, genreIds: toggleIn(f.genreIds, id) })), [patch]);
  const togglePlatform = useCallback((id: number) => patch((f) => ({ ...f, platformIds: toggleIn(f.platformIds, id) })), [patch]);
  const setYearFrom = useCallback((v: number | null) => patch((f) => ({ ...f, yearFrom: v })), [patch]);
  const setYearTo = useCallback((v: number | null) => patch((f) => ({ ...f, yearTo: v })), [patch]);
  const setRatingMin = useCallback((v: number | null) => patch((f) => ({ ...f, ratingMin: v })), [patch]);
  // Statut et Favoris s'excluent (parité barre web) : poser l'un retire l'autre.
  const setStatusFilter = useCallback((v: string | null) => patch((f) => ({ ...f, statusFilter: v, isFavorite: false })), [patch]);
  const setIsFavorite = useCallback((v: boolean) => patch((f) => ({ ...f, isFavorite: v, statusFilter: v ? null : f.statusFilter })), [patch]);
  const setSortBy = useCallback((v: string) => patch((f) => ({ ...f, sortBy: v })), [patch]);
  const setSortOrder = useCallback((v: string) => patch((f) => ({ ...f, sortOrder: v })), [patch]);
  const clearYears = useCallback(() => patch((f) => ({ ...f, yearFrom: null, yearTo: null })), [patch]);
  const clearRating = useCallback(() => patch((f) => ({ ...f, ratingMin: null })), [patch]);
  const resetFilters = useCallback(() => {
    memory.set(libraryId, DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  }, [libraryId]);

  const activeCount = useMemo(() => {
    let c = 0;
    if (filters.genreIds.length > 0) c++;
    if (filters.platformIds.length > 0) c++;
    if (filters.yearFrom != null || filters.yearTo != null) c++;
    if (filters.ratingMin != null) c++;
    if (filters.statusFilter) c++;
    if (filters.isFavorite) c++;
    return c;
  }, [filters]);

  /** L'API Jellyfin n'accepte pas une plage : chaque année est ÉNUMÉRÉE
   *  (repli 1900 / année courante sur la borne ouverte), comme le web. */
  const yearsParam = useMemo(() => {
    if (filters.yearFrom == null && filters.yearTo == null) return undefined;
    const from = filters.yearFrom ?? 1900;
    const to = filters.yearTo ?? new Date().getFullYear();
    const arr: string[] = [];
    for (let y = from; y <= to; y++) arr.push(String(y));
    return arr;
  }, [filters.yearFrom, filters.yearTo]);

  /** Signature stable de l'état — de quoi remonter le défilement quand un
   *  filtre change réellement. */
  const queryKey = useMemo(() => JSON.stringify(filters), [filters]);

  return {
    filters,
    toggleGenre, togglePlatform, setYearFrom, setYearTo, setRatingMin,
    setStatusFilter, setIsFavorite, setSortBy, setSortOrder,
    clearYears, clearRating, resetFilters,
    activeCount, hasActiveFilters: activeCount > 0,
    yearsParam, queryKey,
  };
}
