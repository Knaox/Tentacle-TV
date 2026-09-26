import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le magasin de la recherche : ce qui survit au démontage de la surcouche, et
 * l'ordre dans lequel Retour referme les choses. Un document minimal suffit —
 * le magasin ne lit que l'élément actif et le défilement de la fenêtre.
 */

class FakeElement {}
const body = new FakeElement();

/** Ce qui a ouvert la recherche : l'entrée du rail, qu'on sait refocaliser. */
class FakeTrigger extends FakeElement {
  tagName = "A";
  textContent = "Rechercher";
  isConnected = true;
  focus = vi.fn();
  getAttribute(): null {
    return null;
  }
}
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

  it("déjà ouverte, revient à la barre au lieu de repartir de zéro", async () => {
    const s = await store();
    const barReturn = vi.fn();
    s.registerBarReturn(barReturn);
    s.openSearch();
    s.settleOpen();
    s.rememberSearchTarget("m|carte");
    s.openBrowse({ kind: "genre", name: "Drame" }, "m|pastille");
    s.openSearch();
    expect(s.isBrowsing()).toBe(false);
    expect(s.isFreshOpen()).toBe(false);
    expect(s.lastSearchTarget()).toBe("m|carte");
    vi.runAllTimers();
    expect(barReturn).toHaveBeenCalledWith("m|pastille");
  });

  it("revient à la barre depuis une étagère, et plus du tout une fois fermée", async () => {
    const s = await store();
    const barReturn = vi.fn();
    const unregister = s.registerBarReturn(barReturn);
    s.openSearch();
    s.openBrowse({ kind: "person", id: "p1", name: "Camille" }, "m|carte");
    expect(s.returnToSearchBar()).toBe(true);
    vi.runAllTimers();
    expect(barReturn).toHaveBeenLastCalledWith("m|carte");
    unregister();
    s.closeSearch();
    expect(s.returnToSearchBar()).toBe(false);
  });

  it("quittée pour un autre écran, ne rend pas le focus à son déclencheur", async () => {
    const trigger = new FakeTrigger();
    (document as unknown as { activeElement: unknown }).activeElement = trigger;
    const s = await store();
    s.openSearch();
    s.closeSearch(false);
    vi.runAllTimers();
    expect(trigger.focus).not.toHaveBeenCalled();
    s.openSearch();
    s.closeSearch();
    vi.runAllTimers();
    expect(trigger.focus).toHaveBeenCalledTimes(1);
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
