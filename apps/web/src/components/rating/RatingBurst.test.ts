import { describe, expect, it } from "vitest";
import { burstParticles } from "./RatingBurst";

describe("burstParticles", () => {
  it("dix particules, toutes bornées et déterministes", () => {
    const a = burstParticles();
    const b = burstParticles();
    expect(a).toHaveLength(10);
    expect(a).toEqual(b);
    for (const p of a) {
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(32);
      expect(Math.abs(p.dy)).toBeLessThanOrEqual(32);
      expect([4, 6]).toContain(p.size);
      expect(p.delay).toBeLessThanOrEqual(40);
    }
  });
  it("l'éventail s'ouvre vers le haut : la particule du milieu monte", () => {
    const mid = burstParticles(11)[5];
    expect(mid.dy).toBeLessThan(0);
    expect(Math.abs(mid.dx)).toBeLessThan(3);
  });
});
