import type { TFunction } from "i18next";
import {
  COLLECTION_SORTS,
  COLLECTION_TYPES,
  collectionActiveFilters,
  isDefaultCollectionSort,
  type CollectionFilterState,
  type CollectionTypeFilter,
} from "@tentacle-tv/tv-core";
import type { ActiveFilterModel, FilterPillModel, FilterSheetModel, LibraryFilterKey } from "../../redesign/screens/library/libraryTypes";
import { SORT_ORDER_LABELS } from "../library/libraryFilterModel";

/**
 * Le type et le tri de Ma liste et des Favoris, MIS EN MOTS pour la barre et
 * les listes de la bibliothèque. Les décisions (critères, ordres naturels,
 * effets, focus) sont celles de tv-core (`focus/collectionFilters.ts`) ;
 * l'ordre lui-même, celui de `filterCollection` (api-client).
 *
 * Le tri par date est celui de l'ARRIVÉE DANS LA BIBLIOTHÈQUE : il porte son
 * propre nom (« Derniers arrivés »), jamais « Derniers ajouts », qui se lirait
 * ici comme les derniers ajouts à la liste — une date qui n'existe pas.
 */

/** Les libellés d'un critère : dans la liste, et la valeur de la pastille selon l'ordre. */
const SORT_LABELS: Readonly<Record<string, { criterion: string; desc: string; asc: string }>> = {
  DateCreated: { criterion: "library:sortArrival", desc: "library:sortArrivalDesc", asc: "library:sortArrivalAsc" },
  SortName: { criterion: "common:sortTitleAsc", desc: `common:${SORT_ORDER_LABELS.SortName.desc}`, asc: `common:${SORT_ORDER_LABELS.SortName.asc}` },
  ProductionYear: { criterion: "common:sortYear", desc: `common:${SORT_ORDER_LABELS.ProductionYear.desc}`, asc: `common:${SORT_ORDER_LABELS.ProductionYear.asc}` },
  CommunityRating: { criterion: "common:sortRatingDesc", desc: `common:${SORT_ORDER_LABELS.CommunityRating.desc}`, asc: `common:${SORT_ORDER_LABELS.CommunityRating.asc}` },
};

const TYPE_LABELS: Readonly<Record<CollectionTypeFilter, string>> = {
  all: "common:allFilter",
  Movie: "common:moviesFilter",
  Series: "common:seriesFilter",
};

function sortValue(t: TFunction, state: CollectionFilterState): string {
  const labels = SORT_LABELS[state.sortBy] ?? SORT_LABELS.DateCreated;
  return t(state.sortOrder === "Descending" ? labels.desc : labels.asc);
}

/** Les deux pastilles : Type, puis Trier par (CO-3). */
export function collectionPillsOf(t: TFunction, state: CollectionFilterState): FilterPillModel[] {
  return [
    { key: "type", label: t("library:contentType"), value: t(TYPE_LABELS[state.type]), active: state.type !== "all" },
    { key: "sort", label: t("common:sortBy"), value: sortValue(t, state), active: !isDefaultCollectionSort(state) },
  ];
}

/** Les filtres actifs : le type, quand il n'est pas « Tous ». */
export function collectionActiveOf(t: TFunction, state: CollectionFilterState): ActiveFilterModel[] {
  return collectionActiveFilters(state).map((id) => ({ id, label: t(TYPE_LABELS[state.type]) }));
}

/** La liste d'une pastille ; « Voir N titres » compte ce que garde l'état courant. */
export function collectionSheetOf(t: TFunction, key: LibraryFilterKey, state: CollectionFilterState, resultCount: number): FilterSheetModel | null {
  const base = { filter: key, applyLabel: t("common:showResultsCount", { count: resultCount }) };
  if (key === "type") {
    return {
      ...base,
      kind: "choice",
      title: t("library:contentType"),
      multiple: false,
      columns: 1,
      options: COLLECTION_TYPES.map((type) => ({ id: type, label: t(TYPE_LABELS[type]), selected: state.type === type })),
    };
  }
  if (key === "sort") {
    return {
      ...base,
      kind: "sort",
      title: t("common:sortBy"),
      criteriaTitle: t("library:sortCriterion"),
      criteria: COLLECTION_SORTS.map((s) => ({ id: s.value, label: t(SORT_LABELS[s.value].criterion), selected: state.sortBy === s.value })),
      orderTitle: t("common:sortOrder"),
      orders: [
        { id: "order:Descending", label: t("common:sortOrderDesc"), selected: state.sortOrder === "Descending" },
        { id: "order:Ascending", label: t("common:sortOrderAsc"), selected: state.sortOrder === "Ascending" },
      ],
    };
  }
  return null;
}
