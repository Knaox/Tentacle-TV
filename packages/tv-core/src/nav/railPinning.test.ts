import { beforeEach, describe, expect, it, vi } from "vitest";

import { RAIL_STORAGE_KEY, createRailPinningStore, type RailStorage } from "./railPinning";

function fakeStorage(initial?: string): RailStorage & { content: Map<string, string> } {
  const content = new Map<string, string>();
  if (initial !== undefined) content.set(RAIL_STORAGE_KEY, initial);
  return {
    content,
    getItem: (c) => content.get(c) ?? null,
    setItem: (c, v) => void content.set(c, v),
  };
}

describe("le rail montre tout par défaut", () => {
  it("part sans rien de masqué quand le stockage est vide", () => {
    const m = createRailPinningStore(fakeStorage());
    expect(m.readSnapshot().masquees).toEqual([]);
  });

  it("montre tout plutôt que rien si le stockage est corrompu", () => {
    // Un rail vide serait le pire cas : plus aucune destination atteignable.
    const m = createRailPinningStore(fakeStorage("{ceci n'est pas du JSON"));
    expect(m.readSnapshot().masquees).toEqual([]);
  });

  it("ignore une forme inattendue sans se casser", () => {
    const m = createRailPinningStore(fakeStorage('{"masquees":"lib-3"}'));
    expect(m.readSnapshot().masquees).toEqual([]);
  });

  it("relit ce qui avait été masqué", () => {
    const m = createRailPinningStore(fakeStorage('{"masquees":["lib-3","favorites"]}'));
    expect(m.isHidden("lib-3")).toBe(true);
    expect(m.isHidden("watchlist")).toBe(false);
  });
});

describe("masquer et rétablir", () => {
  let storage: ReturnType<typeof fakeStorage>;
  let store: ReturnType<typeof createRailPinningStore>;

  beforeEach(() => {
    storage = fakeStorage();
    store = createRailPinningStore(storage);
  });

  it("bascule une entrée et la persiste", () => {
    store.toggle("lib-7");
    expect(store.isHidden("lib-7")).toBe(true);
    expect(JSON.parse(storage.content.get(RAIL_STORAGE_KEY)!)).toEqual({ masquees: ["lib-7"] });
  });

  it("rebasculer la fait revenir", () => {
    store.toggle("lib-7");
    store.toggle("lib-7");
    expect(store.isHidden("lib-7")).toBe(false);
  });

  it("« Tout afficher » vide la liste d'un coup", () => {
    store.toggle("lib-1");
    store.toggle("lib-2");
    store.showAll();
    expect(store.readSnapshot().masquees).toEqual([]);
  });

  it("prévient les abonnés à chaque changement", () => {
    const listener = vi.fn();
    store.subscribe(listener);
    store.toggle("lib-1");
    expect(listener).toHaveBeenCalledTimes(1);
    store.showAll();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("ne prévient personne quand « Tout afficher » n'a rien à faire", () => {
    // Sans cette garde, chaque rendu du rail rejouerait une écriture et une
    // notification pour rien — sur une dalle, ça se paie.
    const listener = vi.fn();
    store.subscribe(listener);
    store.showAll();
    expect(listener).not.toHaveBeenCalled();
  });

  it("se désabonne proprement", () => {
    const listener = vi.fn();
    store.subscribe(listener)();
    store.toggle("lib-1");
    expect(listener).not.toHaveBeenCalled();
  });

  it("survit à un stockage en écriture seule cassée", () => {
    // Une dalle en navigation privée, ou un quota atteint : le rail doit
    // continuer de fonctionner pour la session en cours.
    const broken: RailStorage = {
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
    };
    const m = createRailPinningStore(broken);
    expect(() => m.toggle("lib-1")).not.toThrow();
    expect(m.isHidden("lib-1")).toBe(true);
  });
});

describe("rehydrate — le stockage s'hydrate après la création du magasin", () => {
  it("relit l'état une fois le cache rempli et notifie", () => {
    const storage = fakeStorage();
    const store = createRailPinningStore(storage);
    expect(store.isHidden("lib-3")).toBe(false);

    // L'hydratation asynchrone (RNStorageAdapter, Android TV) remplit le
    // cache APRÈS la création du magasin au chargement du module.
    storage.content.set(RAIL_STORAGE_KEY, '{"masquees":["lib-3"]}');
    const listener = vi.fn();
    store.subscribe(listener);
    store.rehydrate();

    expect(store.isHidden("lib-3")).toBe(true);
    expect(store.readSnapshot().masquees).toEqual(["lib-3"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ne notifie pas quand rien n'a changé", () => {
    const store = createRailPinningStore(fakeStorage('{"masquees":["lib-3"]}'));
    const listener = vi.fn();
    store.subscribe(listener);
    store.rehydrate();
    expect(listener).not.toHaveBeenCalled();
  });
});
