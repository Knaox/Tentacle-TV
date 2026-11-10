import { describe, expect, it } from "vitest";

import { stepForKey, stepForSwipe, wheelIsHorizontal, SWIPE_DISTANCE_PX } from "./useBillboardGestures";

describe("les gestes de la bannière", () => {
  it("← recule et → avance, sans modificateur", () => {
    expect(stepForKey("ArrowLeft", false)).toBe("prev");
    expect(stepForKey("ArrowRight", false)).toBe("next");
    expect(stepForKey("ArrowRight", true)).toBeNull();
    expect(stepForKey("Enter", false)).toBeNull();
  });

  it("un glissé vers la gauche tire la diapositive suivante", () => {
    expect(stepForSwipe(-SWIPE_DISTANCE_PX - 1, 4)).toBe("next");
    expect(stepForSwipe(SWIPE_DISTANCE_PX + 1, -4)).toBe("prev");
  });

  it("un glissé trop court, ou surtout vertical, ne fait rien", () => {
    expect(stepForSwipe(-SWIPE_DISTANCE_PX + 1, 0)).toBeNull();
    expect(stepForSwipe(-80, 70)).toBeNull();
  });

  it("la molette verticale reste au défilement de la page", () => {
    expect(wheelIsHorizontal(0, 120)).toBe(false);
    expect(wheelIsHorizontal(30, 40)).toBe(false);
    expect(wheelIsHorizontal(-40, 10)).toBe(true);
  });
});
