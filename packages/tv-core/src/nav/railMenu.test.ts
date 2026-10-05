import { describe, expect, it } from "vitest";

import {
  RAIL_MENU_ACTIONS, RAIL_MENU_RETURN_WITHIN_MS, canOpenRailMenu, railMenuEffect, railMenuItems, railMenuModel, railMenuReturnOnClose,
  railMenuReturnOnFocus, railMenuReturnTarget, type RailCatalogEntry,
} from "./railMenu";

const entries: RailCatalogEntry[] = [
  { key: "Recommendations", label: "Pour vous", hidden: false },
  { key: "Watchlist", label: "Ma liste", hidden: true },
  { key: "Favorites", label: "Mes favoris", hidden: false },
  { key: "Library_a", label: "Animés", hidden: false },
];

describe("railMenu — le menu d'une entrée", () => {
  it("s'ouvre sur une entrée organisable, jamais pendant un déplacement", () => {
    expect(canOpenRailMenu("Library_a", false)).toBe(true);
    expect(canOpenRailMenu("Library_a", true)).toBe(false);
    for (const key of ["Search", "Home", "RailShowAll", "Settings"]) expect(canOpenRailMenu(key, false)).toBe(false);
  });

  it("sa place parmi les organisables VISIBLES, et ce qu'on peut faire", () => {
    expect(railMenuModel(entries, "Favorites")).toEqual({
      key: "Favorites", label: "Mes favoris", position: 2, count: 3, canUp: true, canDown: true, canShowAll: true,
    });
    expect(railMenuModel(entries, "Recommendations")).toMatchObject({ position: 1, canUp: false });
    expect(railMenuModel(entries, "Library_a")).toMatchObject({ position: 3, canDown: false });
  });

  it("aucun menu sans entrée tenue, ni pour une entrée masquée", () => {
    expect(railMenuModel(entries, null)).toBeNull();
    expect(railMenuModel(entries, "Watchlist")).toBeNull();
  });

  it("les lignes : impossibles estompées à leur place, « Tout afficher » seulement s'il y a du masqué", () => {
    expect(railMenuItems({ canUp: false, canDown: true, canShowAll: false })).toEqual([
      { action: "move" },
      { action: "up", disabled: true },
      { action: "down", disabled: false },
      { action: "hide" },
      { action: "settings" },
    ]);
    expect(railMenuItems({ canUp: true, canDown: true, canShowAll: true }).map((item) => item.action)).toEqual([
      "move", "up", "down", "hide", "showAll", "settings",
    ]);
    expect([...RAIL_MENU_ACTIONS]).toEqual(["move", "up", "down", "hide", "showAll", "settings"]);
  });

  it("Monter et Descendre passent par-dessus les masquées ; les autres actions ferment", () => {
    const keys = entries.map((entry) => entry.key);
    const isHidden = (key: string) => key === "Watchlist";
    expect(railMenuEffect("up", "Favorites", keys, isHidden)).toEqual({ kind: "reorder", order: ["Favorites", "Recommendations", "Watchlist", "Library_a"] });
    expect(railMenuEffect("down", "Favorites", keys, isHidden)).toEqual({ kind: "reorder", order: ["Recommendations", "Watchlist", "Library_a", "Favorites"] });
    expect(railMenuEffect("hide", "Favorites", keys, isHidden)).toEqual({ kind: "hide", key: "Favorites" });
    expect(railMenuEffect("showAll", "Favorites", keys, isHidden)).toEqual({ kind: "showAll", returnTo: "Favorites" });
    expect(railMenuEffect("move", "Favorites", keys, isHidden)).toEqual({ kind: "move", key: "Favorites" });
    expect(railMenuEffect("settings", "Favorites", keys, isHidden)).toEqual({ kind: "settings" });
  });
});

describe("railMenu — le focus retrouve l'entrée du menu", () => {
  it("fermé par Retour : l'entrée tenue ; plus d'entrée tenue (second Retour) : rien", () => {
    expect(railMenuReturnOnClose("Library_a", 100)).toEqual({ key: "Library_a", at: 100 });
    expect(railMenuReturnOnClose(null, 100)).toBeNull();
  });

  it("le premier focus rendu au rail, sur une autre case et à temps : réclamer l'entrée", () => {
    const pending = { key: "Library_a", at: 1000 };
    expect(railMenuReturnOnFocus(pending, "nav:Favorites", 1200)).toEqual({ consume: true, claim: "nav:Library_a" });
    expect(railMenuReturnOnFocus(pending, "nav:Library_a", 1200)).toEqual({ consume: true, claim: null });
  });

  it("trop tard : consommée, rien à réclamer", () => {
    expect(railMenuReturnOnFocus({ key: "Library_a", at: 0 }, "nav:Favorites", RAIL_MENU_RETURN_WITHIN_MS + 1)).toEqual({ consume: true, claim: null });
  });

  it("une ligne du menu ou le contenu : l'attente continue", () => {
    const pending = { key: "Library_a", at: 0 };
    expect(railMenuReturnOnFocus(pending, "nav:menu:up", 10)).toEqual({ consume: false, claim: null });
    expect(railMenuReturnOnFocus(pending, "grid:0", 10)).toEqual({ consume: false, claim: null });
    expect(railMenuReturnOnFocus(null, "nav:Home", 10)).toEqual({ consume: false, claim: null });
  });
});

describe("railMenuReturnTarget", () => {
  it("la case de l'entrée, dans le délai seulement", () => {
    const pending = { key: "Library_a", at: 1000 };
    expect(railMenuReturnTarget(pending, 1200)).toBe("nav:Library_a");
    expect(railMenuReturnTarget(pending, 1000 + 60_000)).toBeNull();
    expect(railMenuReturnTarget(null, 1200)).toBeNull();
  });
});
