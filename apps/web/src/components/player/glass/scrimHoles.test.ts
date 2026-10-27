import { describe, expect, it } from "vitest";
import { sameHoles, scrimHoles } from "./scrimHoles";

/**
 * Le voile du lecteur est PERCÉ autour de chaque forme de verre : le verre natif
 * est sous la page, un voile qui passerait sur lui le rendrait gris (lot lg8).
 */

const scrim = { x: 0, y: 740, width: 1280, height: 260 };

describe("les trous du voile", () => {
  it("un rond posé sur le voile : un trou à sa place, dans le repère du voile, rayon borné au cercle", () => {
    const holes = scrimHoles(scrim, [{ x: 600, y: 920, width: 56, height: 56, radius: 9999, scale: 1 }]);
    expect(holes).toEqual([{ x: 600, y: 180, width: 56, height: 56, radius: 28 }]);
  });

  it("une forme hors du voile (un panneau tout en haut) ne perce rien", () => {
    expect(scrimHoles(scrim, [{ x: 10, y: 100, width: 300, height: 200, radius: 24, scale: 1 }])).toEqual([]);
  });

  it("une forme repliée à l'échelle 0 ne perce rien ; à mi-repli, son rayon suit l'échelle", () => {
    expect(scrimHoles(scrim, [{ x: 600, y: 920, width: 0, height: 0, radius: 22, scale: 0 }])).toEqual([]);
    const half = scrimHoles(scrim, [{ x: 600, y: 920, width: 160, height: 22, radius: 22, scale: 0.5 }]);
    expect(half[0]!.radius).toBe(11);
  });

  it("un panneau qui dépasse du voile le perce sur sa partie basse (le reste est hors du dessin)", () => {
    const holes = scrimHoles(scrim, [{ x: 900, y: 500, width: 340, height: 400, radius: 24, scale: 1 }]);
    expect(holes).toEqual([{ x: 900, y: -240, width: 340, height: 400, radius: 24 }]);
  });

  it("rien n'a bougé : mêmes trous (aucun rendu)", () => {
    const shape = { x: 600.2, y: 920.3, width: 56, height: 56, radius: 9999, scale: 1 };
    expect(sameHoles(scrimHoles(scrim, [shape]), scrimHoles(scrim, [{ ...shape }]))).toBe(true);
    expect(sameHoles(scrimHoles(scrim, [shape]), scrimHoles(scrim, [{ ...shape, x: 610 }]))).toBe(false);
  });
});
