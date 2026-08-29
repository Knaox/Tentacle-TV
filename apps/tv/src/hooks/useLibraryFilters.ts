import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_FILTERS,
  catalogParams,
  rememberedFilters,
  rememberFilters,
  type LibraryFilterState,
} from "./libraryCatalogParams";

/**
 * L'état des filtres de bibliothèque — mêmes champs et mêmes défauts que le
 * web (`apps/web/src/hooks/useLibraryFilters.ts`), SANS l'adresse : ici l'état
 * vit dans l'écran, et la pile de navigation native garde l'écran monté quand
 * on ouvre une fiche — le retour retrouve les filtres tels quels, ce que la LG
 * obtient par `filtersMemory` (et qui, comme elle, ne survit pas au
 * redémarrage : c'est voulu).
 *
 * Le modèle lui-même — le type, les défauts, la mémoire de session et la
 * fabrication des paramètres de requête — vit dans `libraryCatalogParams`, hors
 * de React : le rail doit pouvoir le consulter pour précharger le catalogue
 * avec EXACTEMENT la clé que l'écran demandera. Ce hook n'en est que la liaison.
 */
export type { LibraryFilterState } from "./libraryCatalogParams";
export { DEFAULT_FILTERS } from "./libraryCatalogParams";

const toggleIn = <T,>(list: T[], id: T): T[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export function useLibraryFilters(libraryId: string) {
  const [filters, setFilters] = useState<LibraryFilterState>(
    () => rememberedFilters(libraryId),
  );

  // Changement de bibliothèque (écran réutilisé par navigate) : rejouer la
  // mémoire de la nouvelle, ou repartir des défauts.
  const [lastLibraryId, setLastLibraryId] = useState(libraryId);
  if (libraryId !== lastLibraryId) {
    setLastLibraryId(libraryId);
    setFilters(rememberedFilters(libraryId));
  }

  const patch = useCallback((p: (f: LibraryFilterState) => LibraryFilterState) => {
    setFilters((f) => {
      const next = p(f);
      rememberFilters(libraryId, next);
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
    rememberFilters(libraryId, DEFAULT_FILTERS);
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

  /** Ce qu'on demandera au serveur — la MÊME fabrication que le préchargement
   *  du rail, sans quoi les deux clés de cache divergent (cf. le module). */
  const params = useMemo(() => catalogParams(filters), [filters]);

  /** Signature stable de l'état — de quoi remonter le défilement quand un
   *  filtre change réellement. */
  const queryKey = useMemo(() => JSON.stringify(filters), [filters]);

  return {
    filters,
    toggleGenre, togglePlatform, setYearFrom, setYearTo, setRatingMin,
    setStatusFilter, setIsFavorite, setSortBy, setSortOrder,
    clearYears, clearRating, resetFilters,
    activeCount, hasActiveFilters: activeCount > 0,
    params, queryKey,
  };
}
