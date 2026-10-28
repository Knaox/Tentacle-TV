import { describe, expect, it } from "vitest";
import { LIBRARY_TABS, MOBILE_LIBRARY_DEFAULT_TAB, MOBILE_LIBRARY_TABS, mobileLibraryTabParam, parseLibraryTab } from "./libraryModel";

describe("parseLibraryTab : l'onglet d'une adresse", () => {
  it("garde les Albums par défaut (web, bureau)", () => {
    expect(parseLibraryTab(undefined)).toBe("albums");
    expect(parseLibraryTab("inconnu")).toBe("albums");
    expect(parseLibraryTab("artists")).toBe("artists");
  });

  it("prend l'onglet de repli demandé (mobile : Playlists)", () => {
    expect(parseLibraryTab(undefined, MOBILE_LIBRARY_DEFAULT_TAB)).toBe("playlists");
    expect(parseLibraryTab("albums", MOBILE_LIBRARY_DEFAULT_TAB)).toBe("albums");
  });
});

describe("la bibliothèque du mobile s'ouvre sur les Playlists", () => {
  it("les Playlists en tête, les mêmes onglets que partout", () => {
    expect(MOBILE_LIBRARY_TABS[0]).toBe("playlists");
    expect([...MOBILE_LIBRARY_TABS].sort()).toEqual([...LIBRARY_TABS].sort());
  });

  it("l'onglet par défaut laisse l'adresse nue, les autres l'écrivent", () => {
    expect(mobileLibraryTabParam("playlists")).toBeUndefined();
    expect(mobileLibraryTabParam("albums")).toBe("albums");
    expect(mobileLibraryTabParam("artists")).toBe("artists");
  });
});
