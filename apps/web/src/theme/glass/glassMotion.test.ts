import { describe, expect, it } from "vitest";

import { GLASS_FRAMER, GLASS_MORPH_REDUCED, glassMorphProps } from "./glassMotion";

describe("métamorphose du verre", () => {
  it("partage un layoutId préfixé et le ressort morph pour la forme", () => {
    const p = glassMorphProps("player-bar", false);
    expect(p.layoutId).toBe("lg-morph-player-bar");
    expect(p.transition).toMatchObject({ layout: GLASS_FRAMER.morph, type: "spring" });
  });

  it("mouvement réduit : un fondu court, aucun trajet", () => {
    expect(glassMorphProps("x", true).transition).toBe(GLASS_MORPH_REDUCED);
  });

  it("des ressorts framer réalistes (raideur et amortissement positifs, masse 1)", () => {
    for (const s of Object.values(GLASS_FRAMER)) {
      expect(s.stiffness).toBeGreaterThan(100);
      expect(s.damping).toBeGreaterThan(10);
      expect(s.mass).toBe(1);
    }
  });
});
