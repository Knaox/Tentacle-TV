import { describe, expect, it } from "vitest";
import { cardProgress } from "./cardProgress";

describe("cardProgress", () => {
  it("dessine un titre entamé", () => {
    expect(cardProgress({ Played: false, PlayedPercentage: 40 })).toBeCloseTo(0.4);
  });

  it("ne dessine rien sur un titre vu, même revu en partie", () => {
    expect(cardProgress({ Played: true, PlayedPercentage: 40 })).toBeNull();
    expect(cardProgress({ Played: false, PlayedPercentage: 100 })).toBeNull();
  });

  it("ne dessine rien sans avancement", () => {
    expect(cardProgress(undefined)).toBeNull();
    expect(cardProgress({ Played: false })).toBeNull();
    expect(cardProgress({ Played: false, PlayedPercentage: 0 })).toBeNull();
    expect(cardProgress({ Played: false, PlayedPercentage: Number.NaN })).toBeNull();
  });
});
