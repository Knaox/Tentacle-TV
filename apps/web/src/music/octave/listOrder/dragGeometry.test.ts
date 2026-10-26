import { describe, expect, it } from "vitest";
import { dragTarget, edgeScrollSpeed, rowShift } from "./dragGeometry";

describe("géométrie du glisser", () => {
  it("la place visée : rangées entières, bornée à la liste", () => {
    expect(dragTarget(5, 0, 10)).toBe(5);
    expect(dragTarget(5, 27, 10)).toBe(5);
    expect(dragTarget(5, 29, 10)).toBe(6);
    expect(dragTarget(5, -56 * 3, 10)).toBe(2);
    expect(dragTarget(5, 56 * 99, 10)).toBe(9);
    expect(dragTarget(0, -500, 10)).toBe(0);
  });

  it("les autres rangées s'écartent d'une hauteur, et seulement entre départ et arrivée", () => {
    // Vers le bas (2 → 5) : 3, 4, 5 remontent.
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => rowShift(i, 2, 5))).toEqual([0, 0, 0, -56, -56, -56, 0]);
    // Vers le haut (5 → 2) : 2, 3, 4 descendent.
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => rowShift(i, 5, 2))).toEqual([0, 0, 56, 56, 56, 0, 0]);
  });

  it("défilement automatique : nul au centre, plus rapide vers le bord", () => {
    expect(edgeScrollSpeed(500, 0, 1000)).toBe(0);
    expect(edgeScrollSpeed(40, 0, 1000)).toBeLessThan(0);
    expect(edgeScrollSpeed(1, 0, 1000)).toBeLessThan(edgeScrollSpeed(40, 0, 1000));
    expect(edgeScrollSpeed(990, 0, 1000)).toBeGreaterThan(0);
  });
});
