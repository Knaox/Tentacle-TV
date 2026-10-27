import { describe, expect, it } from "vitest";
import { sourceOrdered, sourcePlace, sourceRankDate } from "./musicSourceOrder";

describe("sourcePlace — la place d'un titre d'après la playlist telle qu'elle est", () => {
  it("juste après le titre qui le précède dans la source, quelles que soient les arrivées d'avant", () => {
    // La source : 0 1 2 3 4 5 ; dans la playlist, 1 et 4 (présents à l'import), puis 3 arrivé.
    expect(sourcePlace([1, 3, 4], 2)).toBe(1);
    expect(sourcePlace([1, 3, 4], 5)).toBe(3);
    expect(sourcePlace([1, 3, 4], 0)).toBe(0);
  });

  it("deux arrivées du même trou gardent l'ordre de la source, dans les deux ordres d'arrivée", () => {
    const place = (current: number[], rank: number) => {
      const at = sourcePlace(current, rank)!;
      return [...current.slice(0, at), rank, ...current.slice(at)];
    };
    expect(place(place([1, 9], 5), 3)).toEqual([1, 3, 5, 9]);
    expect(place(place([1, 9], 3), 5)).toEqual([1, 3, 5, 9]);
  });

  it("une entrée hors source n'est pas un repère ; un doublon de rang passe après le dernier", () => {
    expect(sourcePlace([null, 2, null, 6], 4)).toBe(2);
    expect(sourcePlace([2, 2, 6], 2)).toBe(2);
    expect(sourcePlace([null, null], 3)).toBeNull();
    expect(sourcePlace([], 3)).toBeNull();
  });

  it("une playlist réordonnée à la main : après le plus proche rang inférieur, où qu'il soit", () => {
    expect(sourcePlace([8, 2, 5], 6)).toBe(3);
    expect(sourcePlace([8, 2, 5], 3)).toBe(2);
  });
});

describe("sourceOrdered — la réparation", () => {
  it("remet par rang ; un titre hors source suit celui qui le précédait ; rien de perdu", () => {
    const entries = [{ id: "c", r: 2 }, { id: "x", r: null }, { id: "a", r: 0 }, { id: "b", r: 1 }, { id: "y", r: null }];
    expect(sourceOrdered(entries, (e) => e.r).map((e) => e.id)).toEqual(["a", "b", "y", "c", "x"]);
  });

  it("un titre hors source en tête y reste ; deux entrées du même rang gardent leur ordre", () => {
    const entries = [{ id: "x", r: null }, { id: "b2", r: 1 }, { id: "a", r: 0 }, { id: "b1", r: 1 }];
    expect(sourceOrdered(entries, (e) => e.r).map((e) => e.id)).toEqual(["x", "a", "b2", "b1"]);
  });
});

describe("sourceRankDate", () => {
  it("le dernier de la source est le plus récent, toujours avant l'import", () => {
    const dates = [0, 1, 2].map((rank) => sourceRankDate(1_000, 3, rank));
    expect(dates).toEqual([997, 998, 999]);
  });
});
