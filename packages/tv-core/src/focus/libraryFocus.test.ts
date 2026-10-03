import { describe, expect, it } from "vitest";
import {
  filterCriterionOf,
  filterFocusAfterClearAll,
  filterFocusAfterRemove,
  filterPillPress,
  libraryClaimAfterLoad,
  libraryEntryKey,
  libraryFocusMoved,
  libraryPrefetchTarget,
  sheetEntryKey,
  sheetFocusKeys,
  type FilterSheetShape,
} from "./libraryFocus";

const on = { selected: true };
const off = { selected: false };

describe("entrée de la bibliothèque", () => {
  const base = { status: false, loading: false, items: 0, noResults: false };
  it("le panneau d'état, puis la pastille de tête au chargement, puis la première affiche, puis « Tout effacer »", () => {
    expect(libraryEntryKey({ ...base, status: true, loading: true })).toBe("status:primary");
    expect(libraryEntryKey({ ...base, loading: true })).toBe("pill:status");
    expect(libraryEntryKey({ ...base, items: 12 })).toBe("grid:0");
    expect(libraryEntryKey({ ...base, noResults: true })).toBe("empty:primary");
    expect(libraryEntryKey(base)).toBe("pill:status");
  });

  it("premier chargement : la première affiche reprend le focus à la pastille de tête, si personne n'a bougé", () => {
    const loaded = { loading: false, items: 12, moved: false, focusedKey: "pill:status" };
    expect(libraryClaimAfterLoad(loaded)).toBe("grid:0");
    expect(libraryClaimAfterLoad({ ...loaded, moved: true })).toBeNull();
    expect(libraryClaimAfterLoad({ ...loaded, loading: true })).toBeNull();
    expect(libraryClaimAfterLoad({ ...loaded, items: 0 })).toBeNull();
    expect(libraryClaimAfterLoad({ ...loaded, focusedKey: "nav:Home" })).toBeNull();
  });

  it("seul un focus ailleurs que la pastille de tête, hors navigation, compte comme un geste", () => {
    expect(libraryFocusMoved("pill:genres", false)).toBe(true);
    expect(libraryFocusMoved("pill:status", false)).toBe(false);
    expect(libraryFocusMoved("nav:Home", true)).toBe(false);
  });
});

describe("barre de filtres", () => {
  it("Favoris bascule, les autres pastilles ouvrent leur liste", () => {
    expect(filterPillPress("favorites")).toBe("toggleFavorites");
    expect(filterPillPress("genres")).toBe("openSheet");
  });

  it("le critère d'un filtre actif", () => {
    expect(filterCriterionOf("genre:12")).toBe("genres");
    expect(filterCriterionOf("platform:netflix")).toBe("platforms");
    expect(filterCriterionOf("status")).toBe("status");
  });

  it("retirer un filtre : celui qui prend sa place, sinon le précédent, sinon la pastille du critère", () => {
    expect(filterFocusAfterRemove(["genre:1", "genre:2", "status"], "genre:1")).toBe("active:0");
    expect(filterFocusAfterRemove(["genre:1", "genre:2", "status"], "status")).toBe("active:1");
    expect(filterFocusAfterRemove(["genre:1"], "genre:1")).toBe("pill:genres");
    expect(filterFocusAfterRemove(["platform:x"], "platform:x")).toBe("pill:platforms");
  });

  it("« Tout effacer » : la pastille de tête, ou la première affiche depuis le vide", () => {
    expect(filterFocusAfterClearAll("active:clear")).toBe("pill:status");
    expect(filterFocusAfterClearAll("empty:primary")).toBe("grid:0");
    expect(filterFocusAfterClearAll(null)).toBe("pill:status");
  });
});

describe("grandes listes", () => {
  it("entrent par ce qui est retenu, sinon le premier", () => {
    expect(sheetEntryKey({ kind: "choice", options: [off, on, off] })).toBe("sheet:option:1");
    expect(sheetEntryKey({ kind: "choice", options: [off, off] })).toBe("sheet:option:0");
    expect(sheetEntryKey({ kind: "sort", criteria: [off, off, on], orders: [1, 2] })).toBe("sheet:option:2");
    expect(sheetEntryKey({ kind: "rating", stops: [off, on] })).toBe("sheet:stop:1");
  });

  it("les années : la décennie retenue, sinon la flèche « De »", () => {
    expect(sheetEntryKey({ kind: "years", presets: [off, on] })).toBe("sheet:preset:1");
    expect(sheetEntryKey({ kind: "years", presets: [off, off] })).toBe("sheet:from:prev");
  });

  it("toutes les clés focalisables, « Effacer » s'il existe, « Voir N titres » au bout", () => {
    const sort: FilterSheetShape = { kind: "sort", criteria: [on, off], orders: [1, 2], clearLabel: "Effacer" };
    expect(sheetFocusKeys(sort)).toEqual(["sheet:option:0", "sheet:option:1", "sheet:order:0", "sheet:order:1", "sheet:clear", "sheet:apply"]);
    expect(sheetFocusKeys({ kind: "years", presets: [off] })).toEqual([
      "sheet:from:prev", "sheet:from:next", "sheet:to:prev", "sheet:to:next", "sheet:preset:0", "sheet:apply",
    ]);
  });
});

describe("préchargement depuis la navigation", () => {
  it("seule une entrée de bibliothèque se prépare", () => {
    expect(libraryPrefetchTarget("nav:Library_abc")).toBe("abc");
    expect(libraryPrefetchTarget("nav:Home")).toBeNull();
    expect(libraryPrefetchTarget("grid:0")).toBeNull();
  });
});
