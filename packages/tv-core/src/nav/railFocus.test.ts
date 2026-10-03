import { describe, expect, it } from "vitest";

import { RAIL_COLLAPSE_DELAY_MS, railBlurDelay, railCollapseAfterBlur, railExpanded, railFocusedAfterFocus } from "./railFocus";

describe("railFocus — le rail ouvert ou replié selon le focus", () => {
  it("une clé de la navigation l'ouvre ; une clé de contenu le replie aussitôt", () => {
    expect(railFocusedAfterFocus("nav:Home")).toBe(true);
    expect(railFocusedAfterFocus("nav:menu:move")).toBe(true);
    expect(railFocusedAfterFocus("nav:Requests")).toBe(true);
    expect(railFocusedAfterFocus("hero:primary")).toBe(false);
  });

  it("une entrée qui perd le focus : on attend 30 ms ; une clé de contenu : rien à attendre", () => {
    expect(RAIL_COLLAPSE_DELAY_MS).toBe(30);
    expect(railBlurDelay("nav:Watchlist")).toBe(30);
    expect(railBlurDelay("grid:3")).toBeNull();
  });

  it("le délai passé : replié si le contenu a le focus, ouvert s'il est passé à une autre entrée", () => {
    expect(railCollapseAfterBlur("grid:0")).toBe(true);
    expect(railCollapseAfterBlur("nav:Favorites")).toBe(false);
  });

  it("aucune clé de l'écran n'a le focus (une Modal à magasin propre) : le rail reste ouvert", () => {
    expect(railCollapseAfterBlur(null)).toBe(false);
  });

  it("le menu d'une entrée ou un déplacement gardent le rail ouvert", () => {
    expect(railExpanded({ railFocused: false, heldKey: null, movingKey: null })).toBe(false);
    expect(railExpanded({ railFocused: true, heldKey: null, movingKey: null })).toBe(true);
    expect(railExpanded({ railFocused: false, heldKey: "Library_a", movingKey: null })).toBe(true);
    expect(railExpanded({ railFocused: false, heldKey: null, movingKey: "Library_a" })).toBe(true);
  });
});
