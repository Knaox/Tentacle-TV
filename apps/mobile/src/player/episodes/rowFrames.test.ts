import { describe, expect, it } from "vitest";
import { droppedIn, framePeriod, rowFrameReport } from "./rowFrames";

describe("rowFrames", () => {
  it("le pas d'une image se lit sur les écarts ordinaires, pas sur les pertes", () => {
    expect(framePeriod([16.6, 16.7, 16.8, 50, 16.6])).toBeCloseTo(1000 / 60);
    expect(framePeriod([8.3, 8.4, 8.3, 25])).toBeCloseTo(1000 / 120);
  });

  it("une image perdue est un écart d'au moins une image et demie", () => {
    expect(droppedIn(16.7, 1000 / 60)).toBe(0);
    expect(droppedIn(24, 1000 / 60)).toBe(0);
    expect(droppedIn(33.4, 1000 / 60)).toBe(1);
    expect(droppedIn(70, 1000 / 60)).toBe(3);
  });

  it("le bilan d'un défilement : fréquence, images, pertes, pire écart", () => {
    expect(rowFrameReport([16.7, 16.6, 33.4, 16.7])).toEqual({ hz: 60, frames: 4, dropped: 1, worstMs: 33 });
    expect(rowFrameReport([])).toEqual({ hz: 60, frames: 0, dropped: 0, worstMs: 0 });
  });
});
