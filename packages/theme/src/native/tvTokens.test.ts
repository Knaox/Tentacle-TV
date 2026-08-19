import { describe, expect, it } from "vitest";
import { TV_SHADOW, TV_RADIUS, TV_OVERSCAN_PT, TV_AMBILIGHT } from "./tvTokens";
describe("les jetons natifs se chargent", () => {
  it("expose les trois élévations", () => {
    expect(TV_SHADOW.elev1.shadowRadius).toBe(18);
    expect(TV_SHADOW.elev3.shadowOpacity).toBe(0.85);
  });
  it("expose rayons, overscan et flou en nombres", () => {
    expect(TV_RADIUS.xl).toBe(26);
    expect(TV_OVERSCAN_PT).toEqual({ x: 96, y: 54 });
    // Le halo se transpose par un RAPPORT, jamais par les 48 px du CSS : ceux-là
    // sont des pixels d'écran, `blurRadius` compte en pixels de bitmap.
    expect(TV_AMBILIGHT.rapportFlou).toBeCloseTo(48 / 1524, 6);
    expect(TV_AMBILIGHT.largeurSource).toBe(256);
    expect(TV_AMBILIGHT.couches).toBe(16);
  });
});
