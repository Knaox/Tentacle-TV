import { describe, expect, it } from "vitest";
import { DEFAULT_ADVANCED, advancedCount, catalogFilterCount, toggleIn, yearChipLabel, yearsParam } from "./catalogOptions";

describe("yearsParam", () => {
  it("aucune borne : aucun paramètre", () => {
    expect(yearsParam(null, null)).toBeUndefined();
  });
  it("une plage complète", () => {
    expect(yearsParam(2001, 2003)).toEqual(["2001", "2002", "2003"]);
  });
  it("un bout manquant vaut l'année courante", () => {
    expect(yearsParam(2024, null, 2026)).toEqual(["2024", "2025", "2026"]);
  });
  it("un début manquant vaut 1900", () => {
    expect(yearsParam(null, 1901)).toEqual(["1900", "1901"]);
  });
});

describe("compte des filtres", () => {
  it("rien de posé : zéro", () => {
    expect(advancedCount(DEFAULT_ADVANCED)).toBe(0);
    expect(catalogFilterCount({ advanced: DEFAULT_ADVANCED, genres: 0, status: null, platforms: 0, sortIndex: 0 })).toBe(0);
  });
  it("une famille compte une fois, le tri compte s'il n'est pas le défaut", () => {
    const advanced = { ...DEFAULT_ADVANCED, yearFrom: 2000, yearTo: 2010, isFavorite: true };
    expect(advancedCount(advanced)).toBe(2);
    expect(catalogFilterCount({ advanced, genres: 3, status: "IsUnplayed", platforms: 2, sortIndex: 4 })).toBe(6);
  });
});

describe("yearChipLabel", () => {
  it("une seule année", () => expect(yearChipLabel(2003, 2003)).toBe("2003"));
  it("une plage", () => expect(yearChipLabel(1990, 2000)).toBe("1990 – 2000"));
  it("un bout ouvert", () => expect(yearChipLabel(null, 2010)).toBe("… – 2010"));
});

describe("toggleIn", () => {
  it("ajoute puis retire", () => {
    expect(toggleIn(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleIn(["a", "b"], "a")).toEqual(["b"]);
  });
});
