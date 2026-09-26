/**
 * Les options de tri et de filtre des catalogues de l'app, recopiées :
 * `components/catalog/catalogSorts.ts`, `StatusFilter.tsx`, `CatalogFilterSheet.tsx`
 * (paliers de note) et `screens/collection/collectionSorts.ts`. Plus les
 * petites décisions pures que l'onglet, l'écran d'une bibliothèque et les
 * collections partagent (plage d'années, compte des filtres, libellé d'années).
 */

/** Les huit tris d'un catalogue — des chaînes de tri SERVEUR (Jellyfin). */
export const SORT_OPTIONS = [
  { labelKey: "sortDateDesc", sortBy: "DateCreated", sortOrder: "Descending" },
  { labelKey: "sortDateAsc", sortBy: "DateCreated", sortOrder: "Ascending" },
  { labelKey: "sortTitleAsc", sortBy: "SortName", sortOrder: "Ascending" },
  { labelKey: "sortTitleDesc", sortBy: "SortName", sortOrder: "Descending" },
  { labelKey: "sortYearDesc", sortBy: "ProductionYear,SortName", sortOrder: "Descending" },
  { labelKey: "sortYearAsc", sortBy: "ProductionYear,SortName", sortOrder: "Ascending" },
  { labelKey: "sortRatingDesc", sortBy: "CommunityRating,SortName", sortOrder: "Descending" },
  { labelKey: "sortRatingAsc", sortBy: "CommunityRating,SortName", sortOrder: "Ascending" },
] as const;

/** Les états de visionnage filtrables — catalogue et collections. */
export const STATUS_OPTIONS = [
  { labelKey: "allStatus", value: null },
  { labelKey: "unwatched", value: "IsUnplayed" },
  { labelKey: "inProgress", value: "IsResumable" },
] as const;

/** Les paliers de note minimale de la feuille « Trier et filtrer ». */
export const RATING_STEPS = [null, 5, 6, 7, 8, 9] as const;

/** Les quatre tris de Ma liste et Mes favoris (en mémoire, ceux du bureau). */
export const COLLECTION_SORTS = [
  { key: "sortDateDesc", sortBy: "DateCreated", sortOrder: "Descending" },
  { key: "sortTitleAsc", sortBy: "SortName", sortOrder: "Ascending" },
  { key: "sortYearDesc", sortBy: "ProductionYear", sortOrder: "Descending" },
  { key: "sortRatingDesc", sortBy: "CommunityRating", sortOrder: "Descending" },
] as const;

export const DEFAULT_COLLECTION_SORT = COLLECTION_SORTS[0];

/** Les filtres « de fond » d'un catalogue (`AdvancedFilters` de l'app). */
export interface AdvancedFilters {
  studioIds: string[];
  platformIds: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  isFavorite: boolean;
}

export const DEFAULT_ADVANCED: AdvancedFilters = {
  studioIds: [], platformIds: [], yearFrom: null, yearTo: null, ratingMin: null, isFavorite: false,
};

/**
 * Une plage d'années en liste pour Jellyfin (`Years=`) : un bout manquant vaut
 * 1900 ou l'année courante ; aucune borne, aucun paramètre.
 */
export function yearsParam(from: number | null, to: number | null, currentYear = new Date().getFullYear()): string[] | undefined {
  if (from == null && to == null) return undefined;
  const start = from ?? 1900;
  const end = to ?? currentYear;
  const years: string[] = [];
  for (let y = start; y <= end; y++) years.push(String(y));
  return years;
}

/** Les filtres de fond posés — un par famille, comme le badge de l'app. */
export function advancedCount(f: AdvancedFilters): number {
  let c = 0;
  if (f.studioIds.length > 0) c++;
  if (f.yearFrom != null || f.yearTo != null) c++;
  if (f.ratingMin != null) c++;
  if (f.isFavorite) c++;
  return c;
}

/** Le nombre du bouton de filtres : tout ce que la feuille règle, tri compris s'il n'est pas le défaut. */
export function catalogFilterCount(input: {
  advanced: AdvancedFilters;
  genres: number;
  status: string | null;
  platforms: number;
  sortIndex: number;
}): number {
  return advancedCount(input.advanced)
    + (input.genres > 0 ? 1 : 0)
    + (input.status !== null ? 1 : 0)
    + (input.platforms > 0 ? 1 : 0)
    + (input.sortIndex !== 0 ? 1 : 0);
}

/** « 2003 », « 1990 – 2000 », « … – 2010 » : le libellé de la pastille des années. */
export function yearChipLabel(from: number | null, to: number | null): string {
  return from === to ? String(from) : `${from ?? "…"} – ${to ?? "…"}`;
}

/** Ajoute ou retire une valeur d'une liste (pastilles à bascule). */
export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Le dégradé des contrôles pleins de l'app (`ctlGradient` : violet → mi-chemin → rose, 135°). */
export const CTL_GRADIENT =
  "linear-gradient(135deg, var(--brand) 0%, color-mix(in srgb, var(--brand) 50%, var(--brand-accent)) 55%, var(--brand-accent) 100%)";
