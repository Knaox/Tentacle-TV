import { describe, expect, it } from "vitest";
import {
  SEASONS_ALL_KEY,
  SEASONS_APPLY_KEY,
  canSubmitSeasons,
  checkedSeasons,
  isSeasonsFooterKey,
  seasonFocusKey,
  seasonsSheetEntry,
  seasonsSheetFocusOf,
  seasonsSheetKeys,
  seasonsSheetReady,
  toggleSeason,
} from "./seasonsSheet";

describe("les cibles de la feuille des saisons", () => {
  it("« Toutes » dès deux saisons à demander, puis les saisons, puis la pilule", () => {
    expect(seasonsSheetKeys([1, 2, 3])).toEqual([SEASONS_ALL_KEY, "sheet:season:1", "sheet:season:2", "sheet:season:3", SEASONS_APPLY_KEY]);
    expect(seasonsSheetKeys([4])).toEqual(["sheet:season:4", SEASONS_APPLY_KEY]);
    expect(seasonsSheetKeys([])).toEqual([SEASONS_APPLY_KEY]);
  });

  it("les spéciaux (saison 0) se nomment comme les autres", () => {
    expect(seasonFocusKey(0)).toBe("sheet:season:0");
  });
});

describe("l'entrée de la feuille des saisons", () => {
  it("la saison choisie quand elle se demande", () => {
    expect(seasonsSheetEntry([1, 2, 3], 2)).toBe("sheet:season:2");
  });

  it("sinon la première à cocher — jamais « Toutes »", () => {
    expect(seasonsSheetEntry([2, 3], 1)).toBe("sheet:season:2");
    expect(seasonsSheetEntry([2, 3])).toBe("sheet:season:2");
  });

  it("sinon la pilule", () => {
    expect(seasonsSheetEntry([])).toBe(SEASONS_APPLY_KEY);
    expect(seasonsSheetEntry([], 3)).toBe(SEASONS_APPLY_KEY);
  });

  it("se décide une fois les saisons sues, à l'échec, ou au filet", () => {
    const base = { answered: false, ownedKnown: true, failed: false, waited: false };
    expect(seasonsSheetReady(base)).toBe(false);
    expect(seasonsSheetReady({ ...base, answered: true })).toBe(true);
    expect(seasonsSheetReady({ ...base, answered: true, ownedKnown: false })).toBe(false);
    expect(seasonsSheetReady({ ...base, ownedKnown: false, failed: true })).toBe(true);
    expect(seasonsSheetReady({ ...base, ownedKnown: false, waited: true })).toBe(true);
  });
});

describe("ce que le raccourci lit du focus", () => {
  it("« Toutes », une saison, ou autre chose", () => {
    expect(seasonsSheetFocusOf(SEASONS_ALL_KEY)).toEqual({ kind: "all" });
    expect(seasonsSheetFocusOf("sheet:season:3")).toEqual({ kind: "season", number: 3 });
    expect(seasonsSheetFocusOf(SEASONS_APPLY_KEY)).toEqual({ kind: "other" });
    expect(seasonsSheetFocusOf(null)).toEqual({ kind: "other" });
  });

  it("le pied ne retient que sa pilule", () => {
    expect(isSeasonsFooterKey(SEASONS_APPLY_KEY)).toBe(true);
    expect(isSeasonsFooterKey("sheet:season:1")).toBe(false);
  });
});

describe("cocher et demander", () => {
  it("OK coche une saison, puis la décoche", () => {
    const once = toggleSeason(new Set([1]), 3);
    expect([...once].sort()).toEqual([1, 3]);
    expect([...toggleSeason(once, 1)]).toEqual([3]);
  });

  it("la pilule demande les saisons cochées, dans l'ordre de la feuille", () => {
    expect(checkedSeasons([0, 2, 3], new Set([3, 0]))).toEqual([0, 3]);
    expect(checkedSeasons([0, 2, 3], new Set([5]))).toEqual([]);
  });

  it("une demande part avec au moins une saison, et une seule à la fois", () => {
    expect(canSubmitSeasons([2], false)).toBe(true);
    expect(canSubmitSeasons([], false)).toBe(false);
    expect(canSubmitSeasons([2], true)).toBe(false);
  });
});
