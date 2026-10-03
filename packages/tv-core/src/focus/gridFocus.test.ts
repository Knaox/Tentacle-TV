import { describe, expect, it } from "vitest";
import {
  BROWSE_BACK_KEY,
  browseClaimOnError,
  browseClaimOnItems,
  browseEntryKey,
  collectionEntryKey,
  GRID_END_REACHED_SCREENS,
  gridKey,
  gridLineReveal,
  isGridKey,
} from "./gridFocus";

describe("grille d'affiches", () => {
  it("les clés des affiches", () => {
    expect(gridKey(7)).toBe("grid:7");
    expect(isGridKey("grid:0")).toBe(true);
    expect(isGridKey("pill:status")).toBe(false);
  });

  it("la première ligne ramène la page tout en haut, les autres au plus près", () => {
    expect(gridLineReveal(0)).toBe("start");
    expect(gridLineReveal(1)).toBe("nearest");
    expect(gridLineReveal(40)).toBe("nearest");
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
