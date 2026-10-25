import { beforeEach, describe, expect, it } from "vitest";
import { MAX_PER_MINUTE, resetIntentSlotsForTests, takeIntentSlot } from "./entityIntent";

/** Les pages demandées d'avance au survol : plafonnées à la minute glissante. */
describe("plafond des demandes d'intention", () => {
  beforeEach(resetIntentSlotsForTests);

  it(`${MAX_PER_MINUTE} par minute glissante, puis plus rien jusqu'à ce que la fenêtre avance`, () => {
    const t0 = 1_000_000;
    const granted = Array.from({ length: MAX_PER_MINUTE + 5 }, (_, i) => takeIntentSlot(t0 + i * 100)).filter(Boolean).length;
    expect(granted).toBe(MAX_PER_MINUTE);
    expect(takeIntentSlot(t0 + 59_000)).toBe(false);
    expect(takeIntentSlot(t0 + 60_001)).toBe(true);
  });
});
