import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le magasin de la recherche : ce qui survit au démontage de la surcouche, et
 * l'ordre dans lequel Retour referme les choses. Un document minimal suffit —
 * le magasin ne lit que l'élément actif et le défilement de la fenêtre.
 */

class FakeElement {}
const body = new FakeElement();
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("document", { activeElement: body, body, querySelectorAll: () => [] });
  vi.stubGlobal("window", { pageYOffset: 420 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function store() {
  return import("./searchState");
}

describe("magasin de la recherche", () => {
  it("s'ouvre vide et neuf, garde la saisie jusqu'à la fermeture", async () => {
    const s = await store();
    s.openSearch();
    expect(s.isFreshOpen()).toBe(true);
    s.setSearchQuery("aube");
    s.settleOpen();
    expect(s.isFreshOpen()).toBe(false);
    s.closeSearch();
    s.openSearch();
    expect(s.isFreshOpen()).toBe(true);
  });

  it("ferme la recherche approfondie avant la recherche, et rend ce qui l'avait ouverte", async () => {
    const s = await store();
    s.openSearch();
    s.openBrowse({ kind: "person", id: "p1", name: "Camille" }, "m|opener");
    expect(s.isBrowseFresh()).toBe(true);
    expect(s.closeBrowse()).toEqual({ closed: true, openerKey: "m|opener" });
    expect(s.closeBrowse()).toEqual({ closed: false, openerKey: null });
    expect(s.closeSearch()).toBe(true);
    expect(s.closeSearch()).toBe(false);
  });

  it("n'ouvre rien quand la recherche est fermée", async () => {
    const s = await store();
    s.setSearchQuery("perdu");
    s.openBrowse({ kind: "genre", name: "Drame" }, null);
    s.openSearch();
    expect(s.closeBrowse().closed).toBe(false);
  });

  it("rend une seule fois le défilement de la page recouverte", async () => {
    const s = await store();
    s.openSearch();
    expect(s.takeCoveredScroll()).toBe(420);
    expect(s.takeCoveredScroll()).toBeNull();
  });

  it("retient la dernière cible, et l'oublie à la fermeture", async () => {
    const s = await store();
    s.openSearch();
    s.rememberSearchTarget("m|carte");
    s.rememberSearchTarget(null);
    expect(s.lastSearchTarget()).toBe("m|carte");
    s.closeSearch();
    expect(s.lastSearchTarget()).toBeNull();
  });
});
