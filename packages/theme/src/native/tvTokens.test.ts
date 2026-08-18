import { describe, expect, it } from "vitest";
import { TV_SHADOW, TV_RADIUS, TV_OVERSCAN_PT, TV_AMBILIGHT_BLUR } from "./tvTokens";
describe("les jetons natifs se chargent", () => {
  it("expose les trois élévations", () => {
    expect(TV_SHADOW.elev1.shadowRadius).toBe(18);
    expect(TV_SHADOW.elev3.shadowOpacity).toBe(0.85);
  });
  it("expose rayons, overscan et flou en nombres", () => {
    expect(TV_RADIUS.xl).toBe(26);
    expect(TV_OVERSCAN_PT).toEqual({ x: 96, y: 54 });
    expect(TV_AMBILIGHT_BLUR).toBe(48);
  });
});
