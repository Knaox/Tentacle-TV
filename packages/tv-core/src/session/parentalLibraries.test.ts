import { describe, expect, it } from "vitest";
import { parentalLibrariesCount, parentalLibraryRows, toggleParentalLibrary } from "./parentalLibraries";

const AVAILABLE = [
  { id: "aaaa-1111", name: "Films", collectionType: "movies" },
  { id: "bbbb-2222", name: "Séries", collectionType: "tvshows" },
  { id: "cccc-3333", name: "Dessins animés", collectionType: "movies" },
];

describe("parentalLibraryRows", () => {
  it("null : toutes cochées, dans l'ordre du serveur", () => {
    expect(parentalLibraryRows(AVAILABLE, null).map((row) => row.checked)).toEqual([true, true, true]);
  });

  it("une liste : seules les siennes, identifiants comparés sans tirets ni casse", () => {
    expect(parentalLibraryRows(AVAILABLE, ["CCCC3333"]).map((row) => row.checked)).toEqual([false, false, true]);
  });
});

describe("toggleParentalLibrary", () => {
  it("décocher depuis « toutes » : la liste des autres", () => {
    expect(toggleParentalLibrary(AVAILABLE, null, "aaaa-1111")).toEqual({ kind: "set", allowed: ["bbbb-2222", "cccc-3333"] });
  });

  it("cocher la dernière qui manquait : « toutes » (null)", () => {
    expect(toggleParentalLibrary(AVAILABLE, ["bbbb-2222", "cccc-3333"], "aaaa-1111")).toEqual({ kind: "set", allowed: null });
  });

  it("cocher une bibliothèque de plus : la liste s'allonge", () => {
    expect(toggleParentalLibrary(AVAILABLE, ["cccc-3333"], "bbbb-2222")).toEqual({ kind: "set", allowed: ["bbbb-2222", "cccc-3333"] });
  });

  it("la dernière cochée ne se décoche pas", () => {
    expect(toggleParentalLibrary(AVAILABLE, ["cccc-3333"], "cccc-3333")).toEqual({ kind: "last" });
  });

  it("un identifiant gardé hors de la liste proposée ne compte pas", () => {
    expect(toggleParentalLibrary(AVAILABLE, ["dddd-4444", "cccc-3333"], "cccc-3333")).toEqual({ kind: "last" });
  });
});

describe("parentalLibrariesCount", () => {
  it("combien sur combien ; rien à restreindre sans bibliothèque", () => {
    expect(parentalLibrariesCount(AVAILABLE, ["aaaa-1111"])).toEqual({ on: 1, total: 3 });
    expect(parentalLibrariesCount(AVAILABLE, null)).toEqual({ on: 3, total: 3 });
    expect(parentalLibrariesCount([], null)).toBeNull();
  });
});
