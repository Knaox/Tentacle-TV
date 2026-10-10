import { describe, expect, it } from "vitest";
import {
  PIP_MIN_HEIGHT, PIP_MIN_WIDTH, initialPipSize, parsePipFrame, pipAspect, pipFrameRadii, pipVideoSize, pipWheelFactor, scalePipSize,
} from "./pipGeometry";

/**
 * La taille du PiP : les bornes du PiP natif de KDE (le quart de l'écran), le
 * ratio de l'image gardé à chaque cran de molette, jamais en deçà de ce que
 * les boutons demandent.
 */

describe("pipAspect", () => {
  it("16:9 sans réponse de mpv, ou une réponse absurde", () => {
    expect(pipAspect(null)).toBeCloseTo(16 / 9);
    expect(pipAspect(undefined)).toBeCloseTo(16 / 9);
    expect(pipAspect(0)).toBeCloseTo(16 / 9);
    expect(pipAspect(Number.NaN)).toBeCloseTo(16 / 9);
  });

  it("garde le ratio de l'image, borné entre portrait et cinémascope extrême", () => {
    expect(pipAspect(2.39)).toBeCloseTo(2.39);
    expect(pipAspect(0.2)).toBe(0.5);
    expect(pipAspect(9)).toBe(3);
  });
});

describe("initialPipSize", () => {
  it("flottant : le quart de l'écran, entre 320 et 640 points", () => {
    expect(initialPipSize("floating", 16 / 9, 1920, 1280, null)).toEqual({ width: 480, height: 270 });
    expect(initialPipSize("floating", 16 / 9, 3840, 1280, null).width).toBe(640);
    expect(initialPipSize("floating", 16 / 9, 1024, 900, null).width).toBe(320);
  });

  it("flottant : la largeur choisie à la molette revient", () => {
    expect(initialPipSize("floating", 16 / 9, 1920, 1280, 560)).toEqual({ width: 560, height: 315 });
  });

  it("ancré : 28 % de la fenêtre, 320 points au moins", () => {
    expect(initialPipSize("docked", 16 / 9, 1920, 1280, null)).toEqual({ width: 358, height: 201 });
    expect(initialPipSize("docked", 16 / 9, 1920, 900, null).width).toBe(320);
  });

  it("une image très large ne descend jamais sous la hauteur minimale", () => {
    const size = initialPipSize("floating", 3, 1920, 1280, 256);
    expect(size.height).toBeGreaterThanOrEqual(PIP_MIN_HEIGHT);
    expect(size.width).toBeGreaterThanOrEqual(PIP_MIN_WIDTH);
  });
});

describe("scalePipSize", () => {
  it("un cran agrandit de 10 %, le ratio gardé", () => {
    expect(scalePipSize({ width: 480, height: 270 }, 1.1, 16 / 9, "floating", 1920, 1280)).toEqual({ width: 528, height: 297 });
  });

  it("jamais au-delà de 60 % de l'écran flottant, 45 % de la fenêtre ancré", () => {
    expect(scalePipSize({ width: 1150, height: 647 }, 1.1, 16 / 9, "floating", 1920, 1280).width).toBe(1152);
    expect(scalePipSize({ width: 570, height: 321 }, 1.1, 16 / 9, "docked", 1920, 1280).width).toBe(576);
  });

  it("jamais en deçà de ce que les boutons demandent", () => {
    expect(scalePipSize({ width: 260, height: 146 }, 1 / 1.1, 16 / 9, "floating", 1920, 1280)).toEqual({ width: PIP_MIN_WIDTH, height: PIP_MIN_HEIGHT });
  });
});

describe("le cadre", () => {
  it("lit le cadre rendu par la coquille, et retombe sur la vidéo bord à bord sinon", () => {
    expect(parsePipFrame({ shadow: 14, bezel: 4 })).toEqual({ shadow: 14, bezel: 4 });
    // Une coquille d'avant le cadre répondait `true`.
    expect(parsePipFrame(true)).toEqual({ shadow: 0, bezel: 0 });
    expect(parsePipFrame({ shadow: -1, bezel: 4 })).toEqual({ shadow: 0, bezel: 0 });
    expect(parsePipFrame({ shadow: 14 })).toEqual({ shadow: 0, bezel: 0 });
  });

  it("l'arrondi du liseré recouvre toujours la pointe du coin carré de mpv", () => {
    for (const bezel of [0, 1, 3, 4, 5, 8]) {
      const { outer, inner } = pipFrameRadii({ shadow: 14, bezel });
      // La flèche d'un quart de cercle de rayon `outer` tient dans le liseré.
      expect(outer * (1 - Math.SQRT1_2)).toBeLessThanOrEqual(bezel);
      expect(inner).toBe(Math.max(0, outer - bezel));
    }
    expect(pipFrameRadii({ shadow: 14, bezel: 4 })).toEqual({ outer: 13, inner: 9 });
    expect(pipFrameRadii({ shadow: 14, bezel: 0 })).toEqual({ outer: 0, inner: 0 });
  });

  it("la vidéo, c'est la fenêtre moins le cadre de chaque côté", () => {
    expect(pipVideoSize(516, 306, { shadow: 14, bezel: 4 })).toEqual({ width: 480, height: 270 });
    expect(pipVideoSize(480, 270, { shadow: 0, bezel: 0 })).toEqual({ width: 480, height: 270 });
  });
});

describe("pipWheelFactor", () => {
  it("un cran de souris vaut 10 %, dans les deux sens", () => {
    expect(pipWheelFactor(-100, 0, false)).toBeCloseTo(1.1, 5);
    expect(pipWheelFactor(100, 0, false)).toBeCloseTo(1 / 1.1, 5);
  });

  it("un pas de pavé tactile reste petit — le mouvement est continu", () => {
    const factor = pipWheelFactor(-4, 0, false);
    expect(factor).toBeGreaterThan(1);
    expect(factor).toBeLessThan(1.005);
  });

  it("des lignes comptent comme 40 pixels, et rien ne dépasse un cran", () => {
    expect(pipWheelFactor(-3, 1, false)).toBeCloseTo(1.1, 5);
    expect(pipWheelFactor(-30, 0, true)).toBeGreaterThan(pipWheelFactor(-30, 0, false));
  });
});
