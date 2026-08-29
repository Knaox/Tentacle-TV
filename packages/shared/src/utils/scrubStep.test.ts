import { describe, expect, it } from "vitest";
import { scrubStep, SCRUB_STEP_MIN_S, SCRUB_STEP_MAX_S } from "./scrubStep";

/**
 * Le pas proportionnel : même comportement perçu quelle que soit la durée.
 * Un épisode de trois minutes garde son pas historique ; un film de cinquante
 * avance d'autant, RELATIVEMENT à sa barre.
 */
describe("scrubStep", () => {
  it("garde le pas historique sur les contenus courts", () => {
    expect(scrubStep(180)).toBe(SCRUB_STEP_MIN_S); // 3 min
    expect(scrubStep(500)).toBe(SCRUB_STEP_MIN_S); // ~8 min (harnais machineScrub)
  });

  it("grandit avec la durée (2 % par pas, multiples de 5)", () => {
    expect(scrubStep(20 * 60)).toBe(25); // 20 min → 24
    expect(scrubStep(40 * 60)).toBe(50); // 40 min → 48 → 50
    expect(scrubStep(50 * 60)).toBe(60); // 50 min → 60
  });

  it("plafonne à quatre-vingt-dix secondes sur les très longs contenus", () => {
    expect(scrubStep(90 * 60)).toBe(SCRUB_STEP_MAX_S); // 1 h 30 → 108 → cap
    expect(scrubStep(4 * 3600)).toBe(SCRUB_STEP_MAX_S); // 4 h → cap
  });

  it("retombe sur le plancher quand la durée est inconnue", () => {
    expect(scrubStep(0)).toBe(SCRUB_STEP_MIN_S);
    expect(scrubStep(null)).toBe(SCRUB_STEP_MIN_S);
    expect(scrubStep(undefined)).toBe(SCRUB_STEP_MIN_S);
  });
});
