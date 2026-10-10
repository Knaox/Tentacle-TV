import { describe, expect, it } from "vitest";
import { PIP_MARGIN } from "./pipCaptions";
import { PIP_FRAME, PIP_INSET, PIP_MIN_WIDTH, pipWindowSize } from "./pipFrame";
import { clampVisible, cornerPlacement, dragTo, resizeInPlace, stretchFrom } from "./pipPlacement";

/**
 * Les règles de la colle KWin, rejouées par la coquille sur macOS et Windows :
 * le même PiP partout — même coin, même marge, mêmes gestes.
 */

const SCREEN = { x: 0, y: 25, width: 1512, height: 924 };
const SHADOW = PIP_FRAME.shadow;
const window480 = pipWindowSize(480, 270);

describe("cornerPlacement", () => {
  it("pose le cadre VISIBLE à la marge du coin bas-droit — l'ombre déborde", () => {
    const box = cornerPlacement(window480, SCREEN);
    expect(box.x + box.width - SHADOW).toBe(SCREEN.x + SCREEN.width - PIP_MARGIN);
    expect(box.y + box.height - SHADOW).toBe(SCREEN.y + SCREEN.height - PIP_MARGIN);
    expect(box).toMatchObject(window480);
  });
});

describe("resizeInPlace", () => {
  it("garde fixe le coin le plus proche du bord : rangé en bas à droite, il grandit vers le haut-gauche", () => {
    const before = cornerPlacement(window480, SCREEN);
    const after = resizeInPlace(before, pipWindowSize(640, 360), SCREEN);
    expect(after.x + after.width).toBe(before.x + before.width);
    expect(after.y + after.height).toBe(before.y + before.height);
  });

  it("en haut à gauche, il grandit vers le bas-droit", () => {
    const before = { x: 40, y: 60, ...window480 };
    const after = resizeInPlace(before, pipWindowSize(640, 360), SCREEN);
    expect(after).toMatchObject({ x: 40, y: 60 });
  });
});

describe("clampVisible", () => {
  it("laisse déborder l'ombre, jamais le cadre visible", () => {
    const box = clampVisible({ x: -500, y: 2000, ...window480 }, SCREEN);
    expect(box.x).toBe(SCREEN.x - SHADOW);
    expect(box.y + box.height - SHADOW).toBe(SCREEN.y + SCREEN.height);
  });
});

describe("dragTo", () => {
  it("garde le point saisi sous le curseur", () => {
    const start = { x: 400, y: 300, ...window480 };
    const box = dragTo(start, { x: 162, y: 102 }, { x: 700, y: 500 }, SCREEN);
    expect(box).toMatchObject({ x: 538, y: 398, width: start.width, height: start.height });
  });
});

describe("stretchFrom", () => {
  const start = { x: 800, y: 500, ...window480 };

  it("tirer le coin haut-gauche : le coin bas-droit reste fixe, le ratio est gardé", () => {
    const box = stretchFrom(start, "top-left", -160, -90, 1000);
    expect(box.x + box.width).toBe(start.x + start.width);
    expect(box.y + box.height).toBe(start.y + start.height);
    expect(box.width - 2 * PIP_INSET).toBe(640);
    expect(box.height - 2 * PIP_INSET).toBe(360);
  });

  it("un geste seulement horizontal agit à mi-course", () => {
    const box = stretchFrom(start, "bottom-right", 160, 0, 1000);
    expect(box).toMatchObject({ x: start.x, y: start.y });
    const width = box.width - 2 * PIP_INSET;
    expect(width).toBeGreaterThan(480);
    expect(width).toBeLessThan(640);
  });

  it("ne descend pas sous la taille minimale, ne dépasse pas la part d'écran", () => {
    expect(stretchFrom(start, "bottom-right", -2000, -2000, 1000).width - 2 * PIP_INSET).toBe(PIP_MIN_WIDTH);
    expect(stretchFrom(start, "bottom-right", 5000, 5000, 900).width - 2 * PIP_INSET).toBe(900);
  });
});
