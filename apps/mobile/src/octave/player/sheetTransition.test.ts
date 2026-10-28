import { describe, expect, it } from "vitest";
import { CONTENT_FADE_RANGE, phoneMiniRect, rangeProgress, sheetFrame, sheetOrigin, sheetRadius, tabletMiniRect } from "./sheetTransition";

describe("passage mini-lecteur ↔ lecteur", () => {
  it("part de la place exacte de la pastille du téléphone", () => {
    const rect = phoneMiniRect(390, 844, 83, 64, 8);
    expect(rect).toEqual({ top: 689, left: 12, width: 366, height: 64 });
    const origin = sheetOrigin(rect, 390, 844);
    // À 0 : le rectangle VISIBLE de la forme (écran mis à l'échelle autour de son centre) est la pastille.
    const f = sheetFrame(origin, 0);
    const top = 844 / 2 + f.translateY - (844 * f.scaleY) / 2;
    const left = 390 / 2 + f.translateX - (390 * f.scaleX) / 2;
    expect(top).toBeCloseTo(689);
    expect(844 * f.scaleY).toBeCloseTo(64);
    expect(left).toBeCloseTo(12);
    expect(390 * f.scaleX).toBeCloseTo(366);
    // À 1 : l'écran entier, sans coins.
    expect(sheetFrame(origin, 1)).toEqual({ translateY: 0, translateX: 0, scaleX: 1, scaleY: 1 });
    expect(sheetRadius(1)).toBe(0);
    expect(sheetRadius(0.5)).toBe(28);
  });

  it("suit la pastille décentrée de la tablette", () => {
    const rect = tabletMiniRect(1024, 768, 64, 248, { left: 0, right: 0, bottom: 20 });
    expect(rect).toEqual({ top: 684, left: 264, width: 744, height: 64 });
    const origin = sheetOrigin(rect, 1024, 768);
    expect(origin.translateX).toBeCloseTo(264 + 372 - 512);
    expect(origin.translateY).toBeCloseTo(684 + 32 - 384);
  });

  it("monte du bas de l'écran sans pastille mesurée", () => {
    expect(sheetOrigin(null, 390, 844)).toEqual({ translateY: 844, scaleX: 1, scaleY: 1, translateX: 0 });
    expect(phoneMiniRect(390, 844, 83, 0, 8)).toBeNull();
    expect(sheetOrigin({ top: 900, left: 12, width: 366, height: 64 }, 390, 844).translateY).toBe(844);
  });

  it("ne montre le contenu qu'une fois la forme lancée, et l'efface d'abord à la fermeture", () => {
    expect(rangeProgress(0.5, CONTENT_FADE_RANGE)).toBe(0);
    expect(rangeProgress(0.775, CONTENT_FADE_RANGE)).toBeCloseTo(0.5);
    expect(rangeProgress(1, CONTENT_FADE_RANGE)).toBe(1);
    // Une progression qui dépasse (ressort) reste bornée.
    expect(rangeProgress(1.08, CONTENT_FADE_RANGE)).toBe(1);
    expect(sheetFrame(sheetOrigin(null, 390, 844), 1.08).translateY).toBe(0);
  });
});
