import { describe, expect, it } from "vitest";
import { GLASS_SPRINGS, bezierAt, springCutSeconds, springMotion, springPosition, type GlassSpring } from "./springCurve";

describe("springPosition / springCutSeconds — la physique de la page", () => {
  it("morph se coupe à 291 ms : la durée de métamorphose de la page", () => {
    expect(Math.round(springCutSeconds(GLASS_SPRINGS.morph) * 1000)).toBe(291);
  });

  it("part de 0, arrive à 1 ; lens dépasse franchement, settle jamais", () => {
    expect(springPosition(GLASS_SPRINGS.morph, 0)).toBe(0);
    expect(springPosition(GLASS_SPRINGS.morph, 3)).toBeCloseTo(1, 6);
    const peak = (spring: GlassSpring): number => {
      let max = 0;
      for (let ms = 0; ms < 2000; ms += 1) max = Math.max(max, springPosition(spring, ms / 1000));
      return max;
    };
    expect(peak(GLASS_SPRINGS.lens)).toBeGreaterThan(1.1);
    expect(peak(GLASS_SPRINGS.settle)).toBeLessThanOrEqual(1);
  });
});

describe("bezierAt", () => {
  it("la diagonale est l'identité, et les bouts sont tenus", () => {
    expect(bezierAt([0, 0, 1, 1], 0.37)).toBeCloseTo(0.37, 4);
    expect(bezierAt([0.2, 0.9, 0.3, 1], 0)).toBeCloseTo(0, 6);
    expect(bezierAt([0.2, 0.9, 0.3, 1], 1)).toBeCloseTo(1, 6);
  });
});

describe("springMotion — la Bézier que l'animateur d'AppKit jouera", () => {
  it("morph : 291 ms, à moins de 2 % du ressort en tout point", () => {
    const motion = springMotion(GLASS_SPRINGS.morph);
    expect(motion.durationMs).toBe(291);
    for (let i = 0; i <= 100; i += 1) {
      const u = i / 100;
      const spring = u === 1 ? 1 : springPosition(GLASS_SPRINGS.morph, u * 0.291);
      expect(Math.abs(bezierAt(motion.points, u) - spring)).toBeLessThan(0.02);
    }
  });

  it("des points tous dans [0, 1] : AppKit rabote le reste (mesuré)", () => {
    for (const spring of Object.values(GLASS_SPRINGS)) {
      for (const p of springMotion(spring).points) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it("calculée une fois par ressort", () => {
    expect(springMotion(GLASS_SPRINGS.lens)).toBe(springMotion({ response: 0.32, dampingFraction: 0.55 }));
  });
});
