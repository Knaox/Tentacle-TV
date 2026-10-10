import { describe, expect, it } from "vitest";
import { PIP_INSET } from "./pipFrame";
import { easeOutCubic, interpolateBox, pictureIn, windowAround } from "./pipMotion";

/**
 * Le passage lecteur ↔ PiP : la fenêtre PiP naît sur l'IMAGE du lecteur — pas
 * sur sa zone et ses bandes noires —, et la vidéo n'y bouge pas d'un point.
 */

describe("pictureIn", () => {
  it("centre l'image 16:9 dans une zone plus haute — bandes noires exclues", () => {
    expect(pictureIn({ x: 116, y: 55, width: 1280, height: 778 }, 16 / 9)).toEqual({
      x: 116, y: 84, width: 1280, height: 720,
    });
  });

  it("une image plus large que la zone (scope) touche les bords gauche et droit", () => {
    const box = pictureIn({ x: 0, y: 0, width: 1000, height: 1000 }, 2.39);
    expect(box.width).toBe(1000);
    expect(box.y).toBe(Math.round((1000 - 1000 / 2.39) / 2));
  });

  it("un ratio illisible vaut 16:9", () => {
    expect(pictureIn({ x: 0, y: 0, width: 1600, height: 1600 }, Number.NaN).height).toBe(900);
  });
});

describe("windowAround", () => {
  it("met la vidéo exactement sur l'image : liseré et ombre autour", () => {
    expect(windowAround({ x: 116, y: 84, width: 1280, height: 720 })).toEqual({
      x: 116 - PIP_INSET, y: 84 - PIP_INSET, width: 1280 + 2 * PIP_INSET, height: 720 + 2 * PIP_INSET,
    });
  });
});

describe("la courbe", () => {
  it("part de l'origine, arrive au but, décélère", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(easeOutCubic(2)).toBe(1);
  });

  it("interpole au point près", () => {
    const from = { x: 0, y: 0, width: 100, height: 50 };
    const to = { x: 100, y: 200, width: 300, height: 150 };
    expect(interpolateBox(from, to, 0)).toEqual(from);
    expect(interpolateBox(from, to, 1)).toEqual(to);
    expect(interpolateBox(from, to, 0.5)).toEqual({ x: 50, y: 100, width: 200, height: 100 });
  });
});
