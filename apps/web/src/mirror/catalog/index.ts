/**
 * Les briques partagées des catalogues du miroir (`components/catalog/*` de
 * l'app) : grille à défilement de fenêtre, filtres, recherche locale.
 */
export { CatalogGrid, GridSkeleton } from "./CatalogGrid";
export { CatalogFilterSheet } from "./CatalogFilterSheet";
export { FilterButton } from "./FilterButton";
export { ActiveFilterChips, FilterChip, FilterSection, type ActiveChip } from "./FilterChip";
export { FilterSheetFrame } from "./FilterSheetFrame";
export { LibraryFilterBar } from "./LibraryFilterBar";
export { ScopedSearchEmpty } from "./ScopedSearchEmpty";
export { ScopedSearchField } from "./ScopedSearchField";
export { ScrollTopFab } from "./ScrollTopFab";
export { useLibraryCatalogState, type LibraryCatalogState } from "./useLibraryCatalogState";
export * from "./catalogOptions";
export { useBackOrHome } from "./useBackOrHome";
