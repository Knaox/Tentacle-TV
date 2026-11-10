import { describe, expect, it } from "vitest";
import { ringAngles } from "./QueueRing";

/**
 * L'anneau du lot ne s'anime qu'en `transform` : deux rotations, une par moitié. La droite
 * couvre la première moitié de l'avancement, la gauche la seconde.
 */
describe("ringAngles", () => {
  it("remplit d'abord la moitié droite, puis la gauche", () => {
    expect(ringAngles(0)).toEqual({ right: 0, left: 0 });
    expect(ringAngles(0.25)).toEqual({ right: 90, left: 0 });
    expect(ringAngles(0.5)).toEqual({ right: 180, left: 0 });
    expect(ringAngles(0.75)).toEqual({ right: 180, left: 90 });
    expect(ringAngles(1)).toEqual({ right: 180, left: 180 });
  });

  it("ne sort jamais du cercle", () => {
    expect(ringAngles(-0.4)).toEqual({ right: 0, left: 0 });
    expect(ringAngles(3)).toEqual({ right: 180, left: 180 });
    expect(ringAngles(Number.NaN)).toEqual({ right: 0, left: 0 });
  });

  it("n'avance jamais à reculons quand l'avancement monte", () => {
    let previous = 0;
    for (let step = 0; step <= 100; step += 1) {
      const { right, left } = ringAngles(step / 100);
      expect(right + left).toBeGreaterThanOrEqual(previous);
      previous = right + left;
    }
  });
});
