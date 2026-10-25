import { describe, expect, it } from "vitest";
import { settleOrder } from "./stableOrder";

const rows = (...keys: string[]) => keys.map((key) => ({ key, v: 1 }));

describe("liste révisée sans bouger sous la main", () => {
  it("relâchée : l'ordre du serveur", () => {
    expect(settleOrder(rows("a", "b"), rows("b", "c", "a"), false).map((r) => r.key)).toEqual(["b", "c", "a"]);
  });

  it("tenue : les rangées affichées gardent leur place, aucune ne disparaît, les nouvelles vont en bas", () => {
    expect(settleOrder(rows("a", "b", "c"), rows("c", "d", "a"), true).map((r) => r.key)).toEqual(["a", "b", "c", "d"]);
  });

  it("tenue : une rangée gardée prend sa version la plus récente", () => {
    const next = [{ key: "a", v: 2 }];
    expect(settleOrder(rows("a"), next, true)[0].v).toBe(2);
  });
});
