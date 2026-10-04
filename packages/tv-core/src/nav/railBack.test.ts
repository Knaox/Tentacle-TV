import { describe, expect, it } from "vitest";

import { resolveBack } from "./backResolve";
import { RAIL_PROFILE_FOCUS_KEY, railEntryTarget, railScreenBackLayers, type RailBackState } from "./railBack";

const page = (overrides: Partial<RailBackState> = {}): RailBackState => ({
  railPage: true, railFocused: false, onProfile: false, moving: false, menuOpen: false, ...overrides,
});

describe("railScreenBackLayers — Retour sur un écran à rail", () => {
  it("page du rail, focus dans la page : le rail s'ouvre", () => {
    expect(resolveBack(railScreenBackLayers(page()), { pushed: false })).toMatchObject({ kind: "layer", action: "openRail" });
  });

  it("rail ouvert : le profil", () => {
    expect(resolveBack(railScreenBackLayers(page({ railFocused: true })), { pushed: false })).toMatchObject({ action: "toProfile" });
  });

  it("déjà sur le profil : la sortie", () => {
    expect(resolveBack(railScreenBackLayers(page({ railFocused: true, onProfile: true })), { pushed: false })).toEqual({ kind: "exit" });
  });

  it("page poussée qui montre le rail : elle recule, rail ouvert ou non", () => {
    expect(resolveBack(railScreenBackLayers(page({ railPage: false })), { pushed: true })).toEqual({ kind: "pop" });
    expect(resolveBack(railScreenBackLayers(page({ railPage: false, railFocused: true })), { pushed: true })).toEqual({ kind: "pop" });
  });

  it("un déplacement ou le menu d'une entrée passent avant tout", () => {
    expect(resolveBack(railScreenBackLayers(page({ railFocused: true, moving: true })), { pushed: false })).toMatchObject({ action: "cancelMove" });
    expect(resolveBack(railScreenBackLayers(page({ railFocused: true, menuOpen: true })), { pushed: false })).toMatchObject({ action: "closeMenu" });
    expect(resolveBack(railScreenBackLayers(page({ railPage: false, menuOpen: true })), { pushed: true })).toMatchObject({ action: "closeMenu" });
  });

  it("les cinq couches, dans l'ordre d'inscription", () => {
    expect(railScreenBackLayers(page()).map((spec) => [spec.id, spec.kind])).toEqual([
      ["rowStart", "page"], ["openRail", "page"], ["toProfile", "rail"], ["cancelMove", "menu"], ["closeMenu", "menu"],
    ]);
  });
});

describe("railScreenBackLayers — Retour dans une rangée défilée (accueil, « Pour vous »)", () => {
  it("une fois : la première carte de la rangée, avant le rail", () => {
    expect(resolveBack(railScreenBackLayers(page({ awayFromRowStart: true })), { pushed: false })).toMatchObject({ kind: "layer", action: "rowStart" });
  });

  it("deux fois : posé sur la première carte, Retour fait ce qu'il faisait — le rail s'ouvre", () => {
    expect(resolveBack(railScreenBackLayers(page({ awayFromRowStart: false })), { pushed: false })).toMatchObject({ action: "openRail" });
  });

  it("une seule couche « page » active à la fois : l'ordre ne dépend pas de l'activation", () => {
    const active = railScreenBackLayers(page({ awayFromRowStart: true })).filter((spec) => spec.active);
    expect(active.map((spec) => spec.id)).toEqual(["rowStart"]);
  });

  it("le rail ouvert ou un menu passent avant, comme avant", () => {
    expect(resolveBack(railScreenBackLayers(page({ awayFromRowStart: true, railFocused: true })), { pushed: false })).toMatchObject({ action: "toProfile" });
    expect(resolveBack(railScreenBackLayers(page({ awayFromRowStart: true, menuOpen: true })), { pushed: false })).toMatchObject({ action: "closeMenu" });
  });
});

describe("railEntryTarget — ouvrir le rail", () => {
  it("sur l'entrée de la page, sinon sur Accueil", () => {
    expect(railEntryTarget("Library_a", () => true)).toBe("nav:Library_a");
    expect(railEntryTarget("Library_a", (key) => key === "nav:Home")).toBe("nav:Home");
    expect(RAIL_PROFILE_FOCUS_KEY).toBe("nav:Settings");
  });
});
