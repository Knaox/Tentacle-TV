import { describe, expect, it } from "vitest";
import { catalogFilterParams, catalogNextPage, getLibraryCatalogKey } from "./useLibraryCatalog";

describe("le catalogue en rangées (téléviseurs)", () => {
  it("la clé d'une grille d'avant ne change pas — le préchargement du rail la retrouve", () => {
    expect(getLibraryCatalogKey("lib", { sortBy: "SortName", limit: 60 })).toHaveLength(16);
    expect(getLibraryCatalogKey("lib", { nameLessThan: "a" })).toHaveLength(20);
  });

  it("les bornes de lettres partent au serveur", () => {
    expect(catalogFilterParams({ nameStartsWithOrGreater: "a", nameLessThan: "d" })).toBe("&NameStartsWithOrGreater=a&NameLessThan=d");
  });

  it("une tranche commence à son début et s'arrête à sa fin, jamais au-delà du catalogue", () => {
    const slice = { offset: 10, maxItems: 15 };
    expect(catalogNextPage(slice, 40, [{ _serverCount: 12 }])).toBe(22);
    expect(catalogNextPage(slice, 40, [{ _serverCount: 12 }, { _serverCount: 3 }])).toBeUndefined();
    expect(catalogNextPage({ offset: 30, maxItems: 15 }, 34, [{ _serverCount: 4 }])).toBeUndefined();
    expect(catalogNextPage({}, 40, [{ _serverCount: 24 }])).toBe(24);
  });
});
