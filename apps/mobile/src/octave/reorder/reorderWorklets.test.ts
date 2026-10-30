import { describe, expect, it } from "vitest";
import { dragTarget, edgeScrollStep, edgeScrollVelocity, rowShift, rowWindow } from "@tentacle-tv/shared/octave";
import { decodeWindow, edgeVelocity, shiftOf, stepOf, targetOf, windowCode } from "./reorderWorklets";

describe("worklets du glisser = règles partagées", () => {
  it("place visée et écart des rangées", () => {
    for (const from of [0, 3, 9]) {
      for (let delta = -800; delta <= 800; delta += 13) expect(targetOf(from, delta, 10, 64)).toBe(dragTarget(from, delta, 10, 64));
      for (let over = 0; over < 10; over++) {
        for (let i = 0; i < 10; i++) expect(shiftOf(i, from, over, 64)).toBe(rowShift(i, from, over, 64));
      }
    }
  });

  it("vitesse du défilement automatique et pas d'une image", () => {
    for (let y = -300; y <= 1300; y += 7) {
      for (const held of [0, 300, 900, 4000]) expect(edgeVelocity(y, 100, 900, held)).toBeCloseTo(edgeScrollVelocity(y, 100, 900, held), 9);
    }
    for (const ms of [0, 8, 16, 33, 80]) expect(stepOf(1500, ms)).toBeCloseTo(edgeScrollStep(1500, ms), 9);
  });

  it("fenêtre montée", () => {
    for (let scroll = 0; scroll <= 12000; scroll += 97) {
      const code = windowCode(scroll, 760, 380, 64, 150, 8, 12);
      expect(decodeWindow(code)).toEqual(rowWindow(scroll, 760, 380, 64, 150, 8, 12));
    }
    expect(decodeWindow(windowCode(0, 760, 0, 64, 0, 8, 12))).toEqual({ first: 0, last: -1 });
  });
});
