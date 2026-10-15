import { describe, expect, it } from "vitest";
import {
  LIBRARY_DELETE_BATCH_MAX,
  deletionAllowedIn,
  deletionAllowedSomewhere,
  normalizeLibraryItemId,
  parseLibraryDeleteRequest,
} from "./libraryDeleteContract";

const A = "a".repeat(32);
const LIB = "84b49bd6a180d1ca614bbbd9227cb992";

describe("parseLibraryDeleteRequest", () => {
  it("normalise, dédoublonne et garde l'ordre reçu", () => {
    expect(parseLibraryDeleteRequest({ ids: [LIB.toUpperCase(), A, LIB] })).toEqual([LIB, A]);
    expect(normalizeLibraryItemId("84b49bd6-a180-d1ca-614b-bbd9227cb992")).toBe(LIB);
  });

  it("refuse le lot entier pour un seul identifiant illisible, une clé de trop, un lot vide ou trop gros", () => {
    expect(parseLibraryDeleteRequest({ ids: [A, "../Users/Me"] })).toBeNull();
    expect(parseLibraryDeleteRequest({ ids: [A], recursive: true })).toBeNull();
    expect(parseLibraryDeleteRequest({ ids: [] })).toBeNull();
    expect(parseLibraryDeleteRequest([A])).toBeNull();
    const many = Array.from({ length: LIBRARY_DELETE_BATCH_MAX + 1 }, (_, i) => i.toString(16).padStart(32, "0"));
    expect(parseLibraryDeleteRequest({ ids: many })).toBeNull();
    expect(parseLibraryDeleteRequest({ ids: many.slice(1) })).toHaveLength(LIBRARY_DELETE_BATCH_MAX);
  });
});

describe("deletionAllowedIn", () => {
  it("partout, une bibliothèque nommée, ou nulle part", () => {
    expect(deletionAllowedIn({ everywhere: true, libraryIds: [] }, LIB)).toBe(true);
    expect(deletionAllowedIn({ everywhere: false, libraryIds: [LIB] }, "84B49BD6-A180-D1CA-614B-BBD9227CB992")).toBe(true);
    expect(deletionAllowedIn({ everywhere: false, libraryIds: [LIB] }, A)).toBe(false);
    expect(deletionAllowedIn(undefined, LIB)).toBe(false);
    expect(deletionAllowedSomewhere({ everywhere: false, libraryIds: [] })).toBe(false);
    expect(deletionAllowedSomewhere({ everywhere: false, libraryIds: [LIB] })).toBe(true);
  });
});
