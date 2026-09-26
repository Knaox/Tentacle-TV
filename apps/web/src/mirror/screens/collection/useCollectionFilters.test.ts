import { describe, expect, it } from "vitest";
import { collectionActiveCount, type CollectionFilterState } from "./useCollectionFilters";

const base: CollectionFilterState = {
  search: "",
  type: "all",
  genres: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  statusFilter: null,
  platformIds: [],
  sortBy: "DateCreated",
  sortOrder: "Descending",
};

describe("collectionActiveCount", () => {
  it("l'état par défaut ne compte rien — ni la recherche ni l'onglet de type", () => {
    expect(collectionActiveCount(base)).toBe(0);
    expect(collectionActiveCount({ ...base, search: "dune", type: "Movie" })).toBe(0);
  });
  it("une famille compte une fois, le tri changé aussi", () => {
    expect(
      collectionActiveCount({
        ...base,
        genres: ["Action", "Drame"],
        yearFrom: 2000,
        statusFilter: "IsUnplayed",
        sortBy: "SortName",
        sortOrder: "Ascending",
      }),
    ).toBe(4);
  });
});
