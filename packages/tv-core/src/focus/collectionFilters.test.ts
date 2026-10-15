import { describe, expect, it } from "vitest";
import {
  applyCollectionOption,
  clearCollectionCriterion,
  clearCollectionFilters,
  COLLECTION_HEAD_PILL,
  COLLECTION_PILLS,
  COLLECTION_SORTS,
  collectionActiveFilters,
  collectionFocusAfterClearAll,
  DEFAULT_COLLECTION_FILTERS,
  isDefaultCollectionSort,
  removeCollectionFilter,
  type CollectionFilterState,
} from "./collectionFilters";
import { filterFocusAfterRemove, filterPillKey, filterPillPress, filterSheetEntryKey } from "./libraryFocus";

const base = DEFAULT_COLLECTION_FILTERS;

describe("Ma liste et Favoris : type et tri", () => {
  it("le défaut garde l'ordre d'avant : arrivées récentes d'abord, tous les types", () => {
    expect(base).toEqual({ type: "all", sortBy: "DateCreated", sortOrder: "Descending" });
    expect(isDefaultCollectionSort(base)).toBe(true);
    expect(collectionActiveFilters(base)).toEqual([]);
  });

  it("la barre : Type puis Trier par, chaque pastille ouvre sa liste", () => {
    expect(COLLECTION_PILLS).toEqual(["type", "sort"]);
    expect(COLLECTION_PILLS.map(filterPillPress)).toEqual(["openSheet", "openSheet"]);
    expect(COLLECTION_HEAD_PILL).toBe(filterPillKey(COLLECTION_PILLS[0]));
  });

  it("les quatre critères du bureau et du mobile, chacun avec son ordre naturel", () => {
    expect(COLLECTION_SORTS.map((s) => s.value)).toEqual(["DateCreated", "SortName", "ProductionYear", "CommunityRating"]);
    expect(applyCollectionOption(base, "sort", "SortName")).toEqual({ ...base, sortBy: "SortName", sortOrder: "Ascending" });
    expect(applyCollectionOption(base, "sort", "CommunityRating")).toEqual({ ...base, sortBy: "CommunityRating", sortOrder: "Descending" });
    expect(applyCollectionOption(base, "sort", "ProductionYear").sortOrder).toBe("Descending");
  });

  it("l'ordre se règle à part, un critère inconnu ne change rien", () => {
    const titled = applyCollectionOption(base, "sort", "SortName");
    expect(applyCollectionOption(titled, "sort", "order:Descending")).toEqual({ ...titled, sortOrder: "Descending" });
    expect(applyCollectionOption(base, "sort", "order:Ascending").sortOrder).toBe("Ascending");
    expect(applyCollectionOption(base, "sort", "DatePlayed")).toBe(base);
    expect(applyCollectionOption(base, "sort", "order:Sideways")).toBe(base);
    expect(isDefaultCollectionSort(titled)).toBe(false);
  });

  it("le type : Films ou Séries est un filtre actif, Tous non", () => {
    const movies = applyCollectionOption(base, "type", "Movie");
    expect(movies.type).toBe("Movie");
    expect(collectionActiveFilters(movies)).toEqual(["type"]);
    expect(collectionActiveFilters(applyCollectionOption(movies, "type", "all"))).toEqual([]);
    expect(applyCollectionOption(base, "type", "Episode")).toBe(base);
  });

  it("retirer, effacer, tout effacer", () => {
    const state: CollectionFilterState = { type: "Series", sortBy: "SortName", sortOrder: "Ascending" };
    expect(removeCollectionFilter(state, "type")).toEqual({ ...state, type: "all" });
    expect(removeCollectionFilter(state, "genre:x")).toBe(state);
    expect(clearCollectionCriterion(state, "type")).toEqual({ ...state, type: "all" });
    expect(clearCollectionCriterion(state, "sort")).toEqual({ ...state, sortBy: "DateCreated", sortOrder: "Descending" });
    // Le tri n'est pas un filtre : « Tout effacer » le garde.
    expect(clearCollectionFilters(state)).toEqual({ type: "all", sortBy: "SortName", sortOrder: "Ascending" });
  });

  it("le focus : retrait du type vers sa pastille, « Tout effacer » vers la tête ou la première affiche", () => {
    expect(filterFocusAfterRemove(["type"], "type")).toBe("pill:type");
    expect(collectionFocusAfterClearAll("active:clear")).toBe(COLLECTION_HEAD_PILL);
    expect(collectionFocusAfterClearAll(null)).toBe(COLLECTION_HEAD_PILL);
    expect(collectionFocusAfterClearAll("empty:primary")).toBe("grid:0");
  });

  it("une liste s'ouvre sur ce qui est retenu", () => {
    const criteria = COLLECTION_SORTS.map((s) => ({ selected: s.value === "ProductionYear" }));
    expect(filterSheetEntryKey({ kind: "sort", criteria, orders: [0, 1] })).toBe("sheet:option:2");
    expect(filterSheetEntryKey({ kind: "choice", options: [{ selected: false }, { selected: false }, { selected: true }] })).toBe("sheet:option:2");
  });
});
