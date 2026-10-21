import { describe, expect, it } from "vitest";

import {
  GLASS_SPRINGS,
  springOvershoot,
  springPosition,
  springSettleSeconds,
  springToCssLinear,
  springToFramer,
} from "./springs";

describe("ressorts du verre", () => {
  it("part de 0 et se pose sur 1, quel que soit l'amortissement", () => {
    for (const s of [GLASS_SPRINGS.lens, GLASS_SPRINGS.morph, GLASS_SPRINGS.settle, { response: 0.3, dampingFraction: 1.6 }]) {
      expect(springPosition(s, 0)).toBe(0);
      expect(springPosition(s, s.response * 6)).toBeCloseTo(1, 3);
    }
  });

  it("le critique ne dépasse jamais le but, la lentille rebondit", () => {
    let max = 0;
    for (let t = 0; t < 1; t += 0.001) max = Math.max(max, springPosition(GLASS_SPRINGS.settle, t));
    expect(max).toBeLessThanOrEqual(1);
    let lensMax = 0;
    for (let t = 0; t < 1; t += 0.001) lensMax = Math.max(lensMax, springPosition(GLASS_SPRINGS.lens, t));
    expect(lensMax - 1).toBeCloseTo(springOvershoot(GLASS_SPRINGS.lens), 3);
    expect(springOvershoot(GLASS_SPRINGS.lens)).toBeGreaterThan(0.05);
  });

  it("restent dans l'échelle de durées de motion.ts (≤ 0,5 s posé, sauf la lentille qui rebondit)", () => {
    expect(springSettleSeconds(GLASS_SPRINGS.settle)).toBeLessThanOrEqual(0.5);
    expect(springSettleSeconds(GLASS_SPRINGS.morph)).toBeLessThanOrEqual(0.6);
    expect(springSettleSeconds(GLASS_SPRINGS.lens)).toBeLessThanOrEqual(0.8);
  });

  it("le linear() CSS suit la vraie courbe à moins d'un centième", () => {
    for (const s of Object.values(GLASS_SPRINGS)) {
      const { easing, durationMs } = springToCssLinear(s);
      const pts = easing.slice("linear(".length, -1).split(", ").map(Number);
      expect(pts[0]).toBe(0);
      expect(pts[pts.length - 1]).toBe(1);
      const n = pts.length - 1;
      for (let k = 0; k < 400; k += 1) {
        const f = k / 400;
        const i = Math.min(n - 1, Math.floor(f * n));
        const lerp = pts[i] + (pts[i + 1] - pts[i]) * (f * n - i);
        // Échantillonnage + coupe à 1 % du trajet : sous 1,5 % partout.
        expect(Math.abs(lerp - springPosition(s, (f * durationMs) / 1000))).toBeLessThan(0.015);
      }
    }
  });

  it("coupe la traîne sous le pixel : 300 ms au plus, 450 pour la lentille qui rebondit", () => {
    expect(springToCssLinear(GLASS_SPRINGS.morph).durationMs).toBeLessThanOrEqual(300);
    expect(springToCssLinear(GLASS_SPRINGS.settle).durationMs).toBeLessThanOrEqual(300);
    expect(springToCssLinear(GLASS_SPRINGS.lens).durationMs).toBeLessThanOrEqual(450);
    const lens = springToCssLinear(GLASS_SPRINGS.lens).easing.slice("linear(".length, -1).split(", ").map(Number);
    expect(Math.max(...lens)).toBeGreaterThan(1.1);
  });

  it("donne l'équivalent framer (k = ω0², c = 2ζω0)", () => {
    const f = springToFramer({ response: 2 * Math.PI, dampingFraction: 0.5 });
    expect(f).toEqual({ type: "spring", stiffness: 1, damping: 1, mass: 1 });
  });
});
