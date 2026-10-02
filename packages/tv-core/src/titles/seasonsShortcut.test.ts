import { describe, expect, it } from "vitest";
import { allSeasonsChecked, hasAllSeasonsRow, shortcutSeasons, toggleAllSeasons } from "./seasonsShortcut";

const REQUESTABLE = [0, 2, 3];
const none = new Set<number>();

describe("Lecture/Pause dans la feuille des saisons", () => {
  it("demande ce qui est coché, où que soit le focus", () => {
    expect(shortcutSeasons(REQUESTABLE, new Set([3, 0]), { kind: "season", number: 2 })).toEqual([0, 3]);
    expect(shortcutSeasons(REQUESTABLE, new Set([2]), { kind: "other" })).toEqual([2]);
  });

  it("sans rien de coché, demande la saison focalisée", () => {
    expect(shortcutSeasons(REQUESTABLE, none, { kind: "season", number: 3 })).toEqual([3]);
  });

  it("depuis la ligne « Toutes », demande tout, même avec des cases cochées", () => {
    expect(shortcutSeasons(REQUESTABLE, new Set([2]), { kind: "all" })).toEqual([0, 2, 3]);
  });

  it("ne demande rien sur une saison qui ne se demande pas, ni sur le pied sans rien de coché", () => {
    expect(shortcutSeasons(REQUESTABLE, none, { kind: "season", number: 1 })).toEqual([]);
    expect(shortcutSeasons(REQUESTABLE, none, { kind: "other" })).toEqual([]);
    expect(shortcutSeasons([], none, { kind: "all" })).toEqual([]);
  });
});

describe("la ligne « Toutes les saisons manquantes »", () => {
  it("ne paraît que dès deux saisons à demander", () => {
    expect(hasAllSeasonsRow([4])).toBe(false);
    expect(hasAllSeasonsRow([2, 4])).toBe(true);
  });

  it("OK coche tout, puis décoche tout", () => {
    const all = toggleAllSeasons(REQUESTABLE, new Set([2]));
    expect([...all].sort()).toEqual([0, 2, 3]);
    expect(allSeasonsChecked(REQUESTABLE, all)).toBe(true);
    expect(toggleAllSeasons(REQUESTABLE, all).size).toBe(0);
    expect(allSeasonsChecked([], none)).toBe(false);
  });
});
