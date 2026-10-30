import { describe, expect, it } from "vitest";
import { EDGE_MAX_SPEED, EDGE_MIN_SPEED, dragTarget, edgeScrollStep, edgeScrollVelocity, rowShift, rowWindow } from "./dragGeometry";

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
});

describe("défilement automatique (px/s)", () => {
  it("nul au centre, du plus lent au seuil au plus rapide au bord", () => {
    expect(edgeScrollVelocity(500, 0, 1000)).toBe(0);
    const nearThreshold = edgeScrollVelocity(87, 0, 1000);
    expect(nearThreshold).toBeLessThan(0);
    expect(Math.abs(nearThreshold)).toBeLessThan(EDGE_MIN_SPEED + 20);
    expect(edgeScrollVelocity(0, 0, 1000)).toBe(-EDGE_MAX_SPEED);
    expect(edgeScrollVelocity(1000, 0, 1000)).toBe(EDGE_MAX_SPEED);
    // Proportionnelle : chaque pas vers le bord va plus vite.
    expect(Math.abs(edgeScrollVelocity(20, 0, 1000))).toBeGreaterThan(Math.abs(edgeScrollVelocity(50, 0, 1000)));
  });

  it("un doigt AU-DELÀ du bord (sur la barre du haut) vaut le bord, jamais plus", () => {
    expect(edgeScrollVelocity(-200, 0, 1000)).toBe(-EDGE_MAX_SPEED);
    expect(edgeScrollVelocity(1300, 0, 1000)).toBe(EDGE_MAX_SPEED);
  });

  it("tenu au bord, elle accélère, bornée", () => {
    const start = edgeScrollVelocity(0, 0, 1000, 0);
    const later = edgeScrollVelocity(0, 0, 1000, 600);
    const max = edgeScrollVelocity(0, 0, 1000, 5000);
    expect(Math.abs(later)).toBeGreaterThan(Math.abs(start));
    expect(max).toBeCloseTo(-EDGE_MAX_SPEED * 1.8);
    expect(edgeScrollVelocity(0, 0, 1000, 99999)).toBe(max);
  });

  it("une zone visible étroite garde un centre immobile", () => {
    expect(edgeScrollVelocity(250, 100, 400)).toBe(0);
    expect(edgeScrollVelocity(150, 100, 400)).toBeLessThan(0);
  });

  it("le pas suit la durée de l'image, une image en retard ne fait pas un bond", () => {
    expect(edgeScrollStep(1200, 16)).toBeCloseTo(19.2);
    expect(edgeScrollStep(1200, 500)).toBeCloseTo(40.8);
    expect(edgeScrollStep(-1200, 16)).toBeCloseTo(-19.2);
  });
});

describe("fenêtre d'une liste virtualisée", () => {
  it("monte ce qui est visible, élargi, arrondi au paquet", () => {
    // 150 rangées de 64, tête de 400, vue de 800 : 7 rangées visibles, un paquet (0-7), 12 de marge.
    expect(rowWindow(0, 800, 400, 64, 150)).toEqual({ first: 0, last: 7 + 12 });
    const a = rowWindow(4000, 800, 400, 64, 150);
    expect(a.first).toBeLessThanOrEqual(Math.floor((4000 - 400) / 64));
    expect(a.last).toBeGreaterThanOrEqual(Math.floor((4800 - 400) / 64));
    // Quelques pixels plus loin dans le même paquet : la même fenêtre (aucun rendu par image).
    expect(rowWindow(4010, 800, 400, 64, 150)).toEqual(a);
  });

  it("bornée à la liste", () => {
    expect(rowWindow(999999, 800, 0, 64, 150).last).toBe(149);
    expect(rowWindow(0, 800, 0, 64, 0)).toEqual({ first: 0, last: -1 });
    expect(rowWindow(0, 800, 0, 64, 3)).toEqual({ first: 0, last: 2 });
  });
});
