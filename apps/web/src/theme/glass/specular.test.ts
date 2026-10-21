import { describe, expect, it } from "vitest";

import {
  SPECULAR_OVERSCAN,
  SPECULAR_REST_POINT,
  specularAngle,
  specularCssVars,
  specularSettled,
  specularStep,
  specularTarget,
} from "./specular";

const rect = { left: 100, top: 50, width: 200, height: 40 };

describe("reflet spéculaire", () => {
  it("vise la fraction du pointeur, bornée un peu au-delà des bords", () => {
    expect(specularTarget(rect, 200, 70)).toEqual({ u: 0.5, v: 0.5 });
    expect(specularTarget(rect, -500, 900)).toEqual({ u: -SPECULAR_OVERSCAN, v: 1 + SPECULAR_OVERSCAN });
    expect(specularTarget({ ...rect, width: 0 }, 1, 1)).toBe(SPECULAR_REST_POINT);
  });

  it("lisse indépendamment de la cadence de l'écran", () => {
    const from = { u: 0, v: 0 };
    const to = { u: 1, v: 1 };
    const once = specularStep(from, to, 16);
    const twice = specularStep(specularStep(from, to, 8), to, 8);
    expect(twice.u).toBeCloseTo(once.u, 10);
    expect(specularStep(from, to, 60_000).u).toBeCloseTo(1, 1);
  });

  it("finit par se poser", () => {
    let p = { u: 0, v: 0 };
    const to = { u: 0.8, v: 0.2 };
    let frames = 0;
    while (!specularSettled(p, to) && frames < 1000) {
      p = specularStep(p, to, 16);
      frames += 1;
    }
    // ~0,5 s à 60 Hz : la boucle d'image ne tourne pas au-delà.
    expect(frames).toBeLessThan(40);
  });

  it("allume le liseré du côté du pointeur (0° en haut, sens horaire)", () => {
    expect(specularAngle({ u: 0.5, v: 0 }, 200, 40)).toBe(0);
    expect(specularAngle({ u: 1, v: 0.5 }, 200, 40)).toBe(90);
    expect(specularAngle({ u: 0.5, v: 1 }, 200, 40)).toBe(180);
    expect(specularAngle({ u: 0, v: 0.5 }, 200, 40)).toBe(270);
    // Capsule large : un pointeur au bout en haut éclaire le côté, pas la diagonale.
    expect(specularAngle({ u: 1, v: 0 }, 200, 40)).toBeGreaterThan(75);
  });

  it("écrit des fractions sans unité (translate composité)", () => {
    expect(specularCssVars({ u: 0.25, v: 0.5 }, 200, 40)).toEqual({
      "--lg-spec-u": "0.25",
      "--lg-spec-v": "0.5",
      "--lg-spec-angle": "270deg",
    });
  });
});
