/** Les deux teintes d'une image pour le fond ambiant (`ambientTint.ts`). */

import { describe, expect, it } from "vitest";
import { ambientTintsFromPixels } from "./ambientTint";
import { relativeLuminance } from "./contrast";
import { AMBIENT_TINT_MAX_LUMINANCE } from "./paneMaterial";

/** Une image `w × h` : la moitié gauche `left`, la droite `right`. */
function image(w: number, h: number, left: number[], right: number[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = x < w / 2 ? left : right;
      data.set([r as number, g as number, b as number, 255], (y * w + x) * 4);
    }
  }
  return data;
}

const parse = (t: string) => {
  const [r, g, b] = t.split(",").map(Number);
  return { r: r as number, g: g as number, b: b as number, a: 1 };
};

describe("les teintes d'une image", () => {
  it("gauche puis droite, chacune de sa couleur", () => {
    const tints = ambientTintsFromPixels(image(8, 4, [200, 20, 60], [30, 60, 200]), 8, 4);
    expect(tints).not.toBeNull();
    const [left, right] = (tints as readonly [string, string]).map(parse);
    expect(left!.r).toBeGreaterThan(left!.b);
    expect(right!.b).toBeGreaterThan(right!.r);
  });

  it("une affiche jaune ou blanche est ramenée sous la luminance de nos roses", () => {
    const tints = ambientTintsFromPixels(image(8, 4, [255, 230, 0], [255, 240, 60]), 8, 4);
    for (const t of tints ?? []) expect(relativeLuminance(parse(t))).toBeLessThanOrEqual(AMBIENT_TINT_MAX_LUMINANCE + 0.002);
  });

  it("une moitié grise prend la teinte de l'autre ; une image grise n'a pas de teinte", () => {
    const half = ambientTintsFromPixels(image(8, 4, [128, 128, 128], [20, 140, 90]), 8, 4);
    expect(half?.[0]).toBe(half?.[1]);
    expect(ambientTintsFromPixels(image(8, 4, [90, 90, 90], [200, 200, 200]), 8, 4)).toBeNull();
  });

  it("une image transparente n'a pas de teinte", () => {
    expect(ambientTintsFromPixels(new Uint8ClampedArray(8 * 4 * 4), 8, 4)).toBeNull();
  });
});
