import { describe, expect, it } from "vitest";

import { backOutcome, resolveBack, takesBack, type BackLayerSpec } from "./backResolve";
import { RAIL_PAGES, isPushedPage, isRailPage } from "./railPages";

const spec = (id: string, kind: BackLayerSpec["kind"], active: boolean): BackLayerSpec => ({ id, kind, active, action: id });

describe("resolveBack — Retour sur des couches déclarées", () => {
  it("consulte menu > surimpression > page > rail, quel que soit l'ordre de la liste", () => {
    const specs = [spec("rail", "rail", true), spec("page", "page", true), spec("osd", "overlay", true), spec("pistes", "menu", true)];
    expect(resolveBack(specs, { pushed: true })).toEqual({ kind: "layer", id: "pistes", action: "pistes" });
  });

  it("ignore les couches inactives", () => {
    const specs = [spec("pistes", "menu", false), spec("osd", "overlay", false), spec("page", "page", true)];
    expect(resolveBack(specs, { pushed: false })).toEqual({ kind: "layer", id: "page", action: "page" });
  });

  it("à rang égal, la DERNIÈRE de la liste répond", () => {
    const specs = [spec("panneau", "menu", true), spec("feuille", "menu", true)];
    expect(resolveBack(specs, { pushed: false })).toMatchObject({ id: "feuille" });
  });

  it("aucune couche active : une page poussée recule", () => {
    expect(resolveBack([spec("menu", "menu", false)], { pushed: true })).toEqual({ kind: "pop" });
  });

  it("aucune couche active, page non poussée : la plateforme (la sortie)", () => {
    expect(resolveBack([], { pushed: false })).toEqual({ kind: "exit" });
  });

  it("l'action rendue est celle de la couche, nommée", () => {
    const specs: BackLayerSpec<"close" | "leave">[] = [
      { id: "a", kind: "page", active: true, action: "leave" },
      { id: "b", kind: "menu", active: true, action: "close" },
    ];
    expect(resolveBack(specs, { pushed: true })).toEqual({ kind: "layer", id: "b", action: "close" });
  });
});

describe("backOutcome / takesBack — la décision d'avance de la plateforme", () => {
  it("une couche active : prise, la couche répond", () => {
    expect(backOutcome({ layered: true, pushed: false })).toBe("layer");
    expect(takesBack({ layered: true, pushed: false })).toBe(true);
  });

  it("page poussée sans couche : prise, la page recule", () => {
    expect(backOutcome({ layered: false, pushed: true })).toBe("pop");
    expect(takesBack({ layered: false, pushed: true })).toBe(true);
  });

  it("ni couche ni page poussée : laissée à la plateforme, qui quitte", () => {
    expect(backOutcome({ layered: false, pushed: false })).toBe("exit");
    expect(takesBack({ layered: false, pushed: false })).toBe(false);
  });
});

describe("pages du rail et pages poussées", () => {
  it("les pages du rail sont les destinations en onglets", () => {
    expect([...RAIL_PAGES]).toEqual(["Home", "Recommendations", "Search", "Watchlist", "Favorites", "Settings", "Library"]);
    expect(isRailPage("Library")).toBe(true);
    expect(isRailPage("SearchBrowse")).toBe(false);
  });

  it("une page du rail n'est jamais poussée, même au-dessus de l'accueil", () => {
    expect(isPushedPage("Library", true)).toBe(false);
  });

  it("une autre page est poussée si la pile peut reculer", () => {
    expect(isPushedPage("MediaDetail", true)).toBe(true);
    expect(isPushedPage("SearchBrowse", true)).toBe(true);
    expect(isPushedPage("PairCode", false)).toBe(false);
  });
});
