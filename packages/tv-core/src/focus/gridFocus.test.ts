import { describe, expect, it } from "vitest";
import {
  BROWSE_BACK_KEY,
  browseClaimOnError,
  browseClaimOnItems,
  browseEntryKey,
  collectionEntryKey,
  GRID_END_REACHED_SCREENS,
  gridKey,
  gridIndexOf,
  gridLineEntries,
  gridLineKey,
  isGridKey,
} from "./gridFocus";

describe("grille d'affiches", () => {
  it("les clés des affiches", () => {
    expect(gridKey(7)).toBe("grid:7");
    expect(isGridKey("grid:0")).toBe(true);
    expect(isGridKey("pill:status")).toBe(false);
  });


  it("la page suivante part à trois écrans de la fin", () => {
    expect(GRID_END_REACHED_SCREENS).toBe(3);
  });
});

describe("Ma liste et Favoris", () => {
  it("l'erreur, puis le vide, puis la première affiche ; rien pendant le chargement", () => {
    expect(collectionEntryKey({ failed: true, empty: false, cards: 0 })).toBe("status:primary");
    expect(collectionEntryKey({ failed: false, empty: true, cards: 0 })).toBe("empty:primary");
    expect(collectionEntryKey({ failed: false, empty: false, cards: 3 })).toBe("grid:0");
    expect(collectionEntryKey({ failed: false, empty: false, cards: 0 })).toBeNull();
  });

  it("un type qui ne garde aucun titre entre sur « Tout effacer » (CO-4)", () => {
    expect(collectionEntryKey({ failed: false, empty: false, cards: 0, noResults: true })).toBe("empty:primary");
    expect(collectionEntryKey({ failed: false, empty: false, cards: 4, noResults: false })).toBe("grid:0");
    expect(collectionEntryKey({ failed: true, empty: false, cards: 0, noResults: true })).toBe("status:primary");
  });
});

describe("Parcourir", () => {
  it("l'erreur, la première affiche, sinon la croix — seule action", () => {
    expect(browseEntryKey({ failed: true, items: 4 })).toBe("status:primary");
    expect(browseEntryKey({ failed: false, items: 4 })).toBe("grid:0");
    expect(browseEntryKey({ failed: false, items: 0 })).toBe(BROWSE_BACK_KEY);
  });

  it("les affiches arrivées reprennent le focus à la croix, tant qu'aucune affiche ne l'a eu", () => {
    const base = { items: 6, posterSeen: false, focusedKey: BROWSE_BACK_KEY };
    expect(browseClaimOnItems(base)).toBe("grid:0");
    expect(browseClaimOnItems({ ...base, posterSeen: true })).toBeNull();
    expect(browseClaimOnItems({ ...base, focusedKey: "nav:Search" })).toBeNull();
    expect(browseClaimOnItems({ ...base, items: 0 })).toBeNull();
  });

  it("une erreur après le chargement : « Réessayer » reprend le focus à la croix", () => {
    const base = { failed: true, posterSeen: false, focusedKey: BROWSE_BACK_KEY };
    expect(browseClaimOnError(base)).toBe("status:primary");
    expect(browseClaimOnError({ ...base, failed: false })).toBeNull();
    expect(browseClaimOnError({ ...base, posterSeen: true })).toBeNull();
    expect(browseClaimOnError({ ...base, focusedKey: "grid:0" })).toBeNull();
  });
});

describe("gridLineEntries — HAUT et BAS gardent la colonne (GR-7)", () => {
  it("les deux voisines entrent par la même colonne", () => {
    expect(gridLineEntries(10, 6, 30)).toEqual({ above: { line: 0, index: 4 }, below: { line: 2, index: 16 } });
  });

  it("aux bords : rien au-dessus de la première ligne, rien sous la dernière", () => {
    expect(gridLineEntries(3, 6, 30).above).toBeNull();
    expect(gridLineEntries(27, 6, 30).below).toBeNull();
  });

  it("une dernière ligne plus courte entre par sa dernière affiche", () => {
    expect(gridLineEntries(11, 6, 15).below).toEqual({ line: 2, index: 14 });
    expect(gridLineEntries(7, 6, 15).below).toEqual({ line: 2, index: 13 });
  });

  it("hors du catalogue, aucune entrée", () => {
    expect(gridLineEntries(40, 6, 30)).toEqual({ above: null, below: null });
  });

  it("l'index d'une affiche, jamais celui d'une ligne", () => {
    expect(gridIndexOf("grid:12")).toBe(12);
    expect(gridIndexOf("grid:line:2")).toBeNull();
    expect(gridIndexOf("nav:Home")).toBeNull();
    expect(gridIndexOf("lib:3", "lib")).toBe(3);
  });

  it("la clé de la section d'une ligne", () => {
    expect(gridLineKey("grid", 3)).toBe("grid:line:3");
  });
});
