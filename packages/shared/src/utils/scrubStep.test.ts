import { describe, expect, it } from "vitest";
import { pasDeScrub, SCRUB_STEP_MIN_S, SCRUB_STEP_MAX_S } from "./scrubStep";

/**
 * Le pas proportionnel : même comportement perçu quelle que soit la durée.
 * Un épisode de trois minutes garde son pas historique ; un film de cinquante
 * avance d'autant, RELATIVEMENT à sa barre.
 */
describe("pasDeScrub", () => {
  it("garde le pas historique sur les contenus courts", () => {
    expect(pasDeScrub(180)).toBe(SCRUB_STEP_MIN_S); // 3 min
    expect(pasDeScrub(1200)).toBe(SCRUB_STEP_MIN_S); // 20 min
    expect(pasDeScrub(1000)).toBe(SCRUB_STEP_MIN_S); // harnais machineScrub
  });

  it("grandit avec la durée (~0,8 % par pas, multiples de 5)", () => {
    expect(pasDeScrub(30 * 60)).toBe(15); // 30 min → 14,4 → 15
    expect(pasDeScrub(50 * 60)).toBe(25); // 50 min → 24
    expect(pasDeScrub(90 * 60)).toBe(45); // 1 h 30 → 43,2 → 45
  });

  it("plafonne à soixante secondes sur les très longs contenus", () => {
    expect(pasDeScrub(2 * 3600)).toBe(SCRUB_STEP_MAX_S); // 2 h → 57,6 → 60
    expect(pasDeScrub(4 * 3600)).toBe(SCRUB_STEP_MAX_S); // 4 h → cap
  });

  it("retombe sur le plancher quand la durée est inconnue", () => {
    expect(pasDeScrub(0)).toBe(SCRUB_STEP_MIN_S);
    expect(pasDeScrub(null)).toBe(SCRUB_STEP_MIN_S);
    expect(pasDeScrub(undefined)).toBe(SCRUB_STEP_MIN_S);
  });
});
