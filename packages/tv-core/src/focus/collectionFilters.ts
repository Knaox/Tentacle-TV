import { GRID_FIRST_KEY } from "./gridFocus";
import { LIBRARY_EMPTY_ACTION } from "./libraryFocus";

/**
 * Ma liste et les Favoris d'un téléviseur : le TYPE (Tous, Films, Séries) et
 * le TRI, posés par la barre de pastilles et les grandes listes de la
 * bibliothèque (mêmes clés de focus, mêmes gestes) — et le focus qui va avec.
 * Module pur : l'écran tient l'état, la règle de tri est celle de
 * `filterCollection` (api-client), commune au web, au bureau et au mobile.
 *
 * Le tri par date est celui de l'ARRIVÉE DANS LA BIBLIOTHÈQUE (`DateCreated`
 * de Jellyfin), jamais une « date d'ajout à la liste » : ni Jellyfin (un
 * `Likes` ou un `IsFavorite` ne porte aucune date) ni le serveur Tentacle ne
 * la gardent. C'est l'ordre que la liste avait déjà — le défaut.
 */

export type CollectionTypeFilter = "all" | "Movie" | "Series";

export interface CollectionFilterState {
  type: CollectionTypeFilter;
  sortBy: string;
  sortOrder: "Ascending" | "Descending";
}

/** Les pastilles de la barre, dans l'ordre de l'écran (CO-3). */
export const COLLECTION_PILLS = ["type", "sort"] as const;
export type CollectionPill = (typeof COLLECTION_PILLS)[number];

export const COLLECTION_TYPES: readonly CollectionTypeFilter[] = ["all", "Movie", "Series"];

/**
 * Les critères, chacun avec son ordre NATUREL — ceux du bureau et du mobile
 * (`filterCollection` ne sait trier que ceux-là) : choisir un critère pose
 * son ordre.
 */
export const COLLECTION_SORTS = [
  { value: "DateCreated", order: "Descending" },
  { value: "SortName", order: "Ascending" },
  { value: "ProductionYear", order: "Descending" },
  { value: "CommunityRating", order: "Descending" },
] as const;

/** Le défaut : l'ordre que la liste a toujours eu — les arrivées récentes d'abord. */
export const DEFAULT_COLLECTION_FILTERS: CollectionFilterState = {
  type: "all",
  sortBy: "DateCreated",
  sortOrder: "Descending",
};

/** La pastille de tête : « Tout effacer » y rend le focus. */
export const COLLECTION_HEAD_PILL = "pill:type";

export const isDefaultCollectionSort = (state: CollectionFilterState): boolean =>
  state.sortBy === DEFAULT_COLLECTION_FILTERS.sortBy && state.sortOrder === DEFAULT_COLLECTION_FILTERS.sortOrder;

/** Les filtres actifs, un par geste de retrait : le type seulement — le tri ordonne, il ne retire rien. */
export function collectionActiveFilters(state: CollectionFilterState): string[] {
  return state.type === "all" ? [] : ["type"];
}

/** Une option choisie dans une liste (Type, Tri) : l'effet sur l'état. */
export function applyCollectionOption(state: CollectionFilterState, filter: string, id: string): CollectionFilterState {
  if (filter === "type") {
    const type = COLLECTION_TYPES.find((value) => value === id);
    return type ? { ...state, type } : state;
  }
  if (filter === "sort") {
    if (id === "order:Ascending" || id === "order:Descending") return { ...state, sortOrder: id === "order:Ascending" ? "Ascending" : "Descending" };
    const sort = COLLECTION_SORTS.find((s) => s.value === id);
    return sort ? { ...state, sortBy: sort.value, sortOrder: sort.order } : state;
  }
  return state;
}

/** « Effacer » dans une liste : ce critère revient à son défaut. */
export function clearCollectionCriterion(state: CollectionFilterState, filter: string): CollectionFilterState {
  if (filter === "type") return { ...state, type: DEFAULT_COLLECTION_FILTERS.type };
  if (filter === "sort") return { ...state, sortBy: DEFAULT_COLLECTION_FILTERS.sortBy, sortOrder: DEFAULT_COLLECTION_FILTERS.sortOrder };
  return state;
}

/** La croix d'un filtre actif. */
export function removeCollectionFilter(state: CollectionFilterState, id: string): CollectionFilterState {
  return id === "type" ? { ...state, type: "all" } : state;
}

/** « Tout effacer » : les FILTRES tombent, le tri choisi reste (il n'en est pas un). */
export function clearCollectionFilters(state: CollectionFilterState): CollectionFilterState {
  return { ...state, type: DEFAULT_COLLECTION_FILTERS.type };
}

/**
 * Le focus après « Tout effacer » (CO-4) : depuis le vide des filtres trop
 * serrés, la première affiche revenue ; depuis la barre, la pastille de tête.
 */
export function collectionFocusAfterClearAll(focusedKey: string | null): string {
  return focusedKey === LIBRARY_EMPTY_ACTION ? GRID_FIRST_KEY : COLLECTION_HEAD_PILL;
}
