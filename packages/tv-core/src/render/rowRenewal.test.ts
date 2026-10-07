import { describe, expect, it } from "vitest";
import { renewalHead, renewedItems } from "./rowRenewal";

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

describe("la tête d'un renouvellement", () => {
  it("compte les cartes que la piste montre, même en partie", () => {
    // La colonne des résultats de la recherche : ~1 300 points, des affiches de 240 + 36.
    expect(renewalHead(1300, 276)).toBe(5);
    expect(renewalHead(1380, 276)).toBe(5);
    expect(renewalHead(1381, 276)).toBe(6);
  });

  it("en garde une au moins", () => {
    expect(renewalHead(0, 276)).toBe(1);
    expect(renewalHead(500, 0)).toBe(500);
  });
});
