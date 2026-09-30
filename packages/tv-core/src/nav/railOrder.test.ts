import { describe, expect, it } from "vitest";

import { applyRailOrder, moveRailKey, moveRailKeyTo, sameRailOrder } from "./railOrder";

const keys = (list: Array<{ key: string }>) => list.map((item) => item.key);
const entries = (...names: string[]) => names.map((key) => ({ key }));

describe("applyRailOrder — l'ordre choisi, appliqué au catalogue", () => {
  it("un ordre vide garde l'ordre par défaut", () => {
    expect(keys(applyRailOrder(entries("a", "b", "c"), [], (e) => e.key))).toEqual(["a", "b", "c"]);
  });

  it("range les connues dans l'ordre choisi", () => {
    expect(keys(applyRailOrder(entries("a", "b", "c"), ["c", "a", "b"], (e) => e.key))).toEqual(["c", "a", "b"]);
  });

  it("une bibliothèque créée depuis se range à la suite", () => {
    expect(keys(applyRailOrder(entries("a", "neuve", "b"), ["b", "a"], (e) => e.key))).toEqual(["b", "a", "neuve"]);
  });

  it("une clé disparue s'ignore, un doublon ne compte qu'une fois", () => {
    expect(keys(applyRailOrder(entries("a", "b"), ["partie", "b", "a", "b"], (e) => e.key))).toEqual(["b", "a"]);
  });
});

describe("moveRailKeyTo — passer de l'autre côté d'une voisine", () => {
  it("descend juste après la cible", () => {
    expect(moveRailKeyTo(["a", "b", "c", "d"], "b", "c")).toEqual(["a", "c", "b", "d"]);
  });

  it("monte juste avant la cible", () => {
    expect(moveRailKeyTo(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("rien ne bouge pour une clé absente ou identique", () => {
    expect(moveRailKeyTo(["a", "b"], "z", "a")).toEqual(["a", "b"]);
    expect(moveRailKeyTo(["a", "b"], "a", "a")).toEqual(["a", "b"]);
  });
});

describe("moveRailKey — un cran parmi les entrées visibles", () => {
  const hidden = new Set(["h"]);
  const visible = (key: string) => !hidden.has(key);

  it("monte et descend d'un cran", () => {
    expect(moveRailKey(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveRailKey(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("saute les masquées : un appui déplace toujours ce qu'on voit", () => {
    expect(moveRailKey(["a", "h", "b"], "b", -1, visible)).toEqual(["b", "a", "h"]);
    expect(moveRailKey(["a", "h", "b"], "a", 1, visible)).toEqual(["h", "b", "a"]);
  });

  it("aux bords, rien ne bouge", () => {
    expect(moveRailKey(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveRailKey(["a", "b", "h"], "b", 1, visible)).toEqual(["a", "b", "h"]);
  });
});

describe("sameRailOrder", () => {
  it("compare clé pour clé", () => {
    expect(sameRailOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameRailOrder(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameRailOrder(["a"], ["a", "b"])).toBe(false);
  });
});
