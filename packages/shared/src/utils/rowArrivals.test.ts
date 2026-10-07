import { describe, expect, it } from "vitest";
import { rowItemKeys, rowShift } from "./rowArrivals";

describe("rowItemKeys", () => {
  it("la clé est le titre, pas sa place : une insertion en tête ne change aucune autre clé", () => {
    expect(rowItemKeys(["b", "a"])).toEqual(["b", "a"]);
    expect(rowItemKeys(["c", "b", "a"])).toEqual(["c", "b", "a"]);
  });

  it("un doublon reçoit une clé à lui, stable", () => {
    expect(rowItemKeys(["a", "b", "a", "a"])).toEqual(["a", "b", "a~2", "a~3"]);
  });
});

describe("rowShift", () => {
  it("un titre arrivé en tête : lui entre, les autres glissent d'une place", () => {
    const shift = rowShift(["b", "a"], ["c", "b", "a"]);
    expect([...shift.arrived]).toEqual(["c"]);
    expect([...shift.moved]).toEqual([["b", -1], ["a", -1]]);
  });

  it("un titre parti : les suivants reviennent d'une place, personne n'entre", () => {
    const shift = rowShift(["c", "b", "a"], ["c", "a"]);
    expect(shift.arrived.size).toBe(0);
    expect([...shift.moved]).toEqual([["a", 1]]);
  });

  it("un titre remonté en tête (« Reprendre ») : un seul mouvement par carte", () => {
    const shift = rowShift(["a", "b", "c"], ["c", "a", "b"]);
    expect([...shift.moved]).toEqual([["c", 2], ["a", -1], ["b", -1]]);
  });

  it("rien sans version précédente, ni depuis une rangée vide, ni quand rien ne bouge", () => {
    for (const previous of [null, []]) {
      const shift = rowShift(previous, ["a"]);
      expect(shift.arrived.size + shift.moved.size).toBe(0);
    }
    const same = rowShift(["a", "b"], ["a", "b"]);
    expect(same.arrived.size + same.moved.size).toBe(0);
  });
});
