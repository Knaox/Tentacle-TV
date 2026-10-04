import { describe, expect, it } from "vitest";

import { RAIL_HINT_DWELL_MS, RAIL_HINT_MAX_SHOWS, railHintDelay, railHintShownAfter, readRailHintShown } from "./railHint";
import { RAIL_HOME_KEY, RAIL_PROFILE_KEY, RAIL_SEARCH_KEY, RAIL_SWITCH_PROFILE_KEY } from "./railKeys";

const at = (entryKey: string | null, patch: Partial<{ moving: boolean; menuOpen: boolean; shown: number }> = {}) =>
  railHintDelay({ entryKey, moving: false, menuOpen: false, shown: 0, ...patch });

describe("l'indication « Maintenir OK : organiser » du rail", () => {
  it("paraît sur une entrée organisable, après un temps de focus sur elle", () => {
    expect(at("Library_films")).toBe(RAIL_HINT_DWELL_MS);
    expect(at("Watchlist")).toBe(RAIL_HINT_DWELL_MS);
  });

  it("ne paraît jamais là où l'appui maintenu ne fait rien", () => {
    for (const key of [RAIL_SEARCH_KEY, RAIL_HOME_KEY, RAIL_PROFILE_KEY, RAIL_SWITCH_PROFILE_KEY]) expect(at(key)).toBeNull();
    expect(at(null)).toBeNull();
  });

  it("se tait pendant un déplacement et menu ouvert", () => {
    expect(at("Library_films", { moving: true })).toBeNull();
    expect(at("Library_films", { menuOpen: true })).toBeNull();
  });

  it("les premières fois seulement, une fois par passage dans le rail", () => {
    expect(at("Library_films", { shown: RAIL_HINT_MAX_SHOWS - 1 })).toBe(RAIL_HINT_DWELL_MS);
    expect(at("Library_films", { shown: RAIL_HINT_MAX_SHOWS })).toBeNull();
    expect(railHintShownAfter(1, false)).toBe(2);
    // Paru sur une deuxième entrée du même passage : il ne compte pas deux fois.
    expect(railHintShownAfter(2, true)).toBe(2);
  });

  it("relit un compte illisible comme zéro", () => {
    expect(readRailHintShown(null)).toBe(0);
    expect(readRailHintShown("oups")).toBe(0);
    expect(readRailHintShown("-3")).toBe(0);
    expect(readRailHintShown("2")).toBe(2);
  });
});
