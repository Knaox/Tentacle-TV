import { describe, expect, it } from "vitest";
import { renewedItems } from "./rowRenewal";

describe("le renouvellement échelonné d'une rangée", () => {
  it("montre la nouvelle liste jusqu'à la part libérée, l'ancienne carte après", () => {
    expect(renewedItems(["a", "b", "c", "d"], ["w", "x", "y", "z"], 2)).toEqual(["a", "b", "y", "z"]);
  });

  it("ne garde rien au-delà de la nouvelle longueur", () => {
    expect(renewedItems(["a", "b"], ["w", "x", "y", "z"], 1)).toEqual(["a", "x"]);
  });

  it("n'invente pas de place : une carte nouvelle attend sa part", () => {
    expect(renewedItems(["a", "b", "c", "d"], ["w"], 2)).toEqual(["a", "b"]);
    expect(renewedItems(["a", "b", "c"], [], 0)).toEqual([]);
  });

  it("rend la nouvelle liste elle-même une fois tout libéré", () => {
    const next = ["a", "b"];
    expect(renewedItems(next, ["w", "x", "y"], 2)).toBe(next);
    expect(renewedItems(next, [], 5)).toBe(next);
  });
});
