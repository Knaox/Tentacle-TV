import { describe, expect, it } from "vitest";
import { CONTENT_FADE_RANGE, phoneMiniRect, rangeProgress, sheetFrame, sheetOrigin, tabletMiniRect } from "./sheetTransition";

describe("passage mini-lecteur ↔ lecteur", () => {
  it("part de la place exacte de la pastille du téléphone", () => {
    const rect = phoneMiniRect(390, 844, 83, 64, 8);
    expect(rect).toEqual({ top: 689, left: 12, width: 366 });
    const origin = sheetOrigin(rect, 390, 844);
    expect(origin.translateY).toBe(689);
    expect(origin.scaleX).toBeCloseTo(366 / 390);
    expect(origin.translateX).toBe(0);
    // À 0 : la forme est la pastille ; à 1 : l'écran entier.
    expect(sheetFrame(origin, 0)).toEqual({ translateY: 689, translateX: 0, scaleX: origin.scaleX });
    expect(sheetFrame(origin, 1)).toEqual({ translateY: 0, translateX: 0, scaleX: 1 });
  });

  it("suit la pastille décentrée de la tablette", () => {
    const rect = tabletMiniRect(1024, 768, 64, 248, { left: 0, right: 0, bottom: 20 });
    expect(rect).toEqual({ top: 684, left: 264, width: 744 });
    const origin = sheetOrigin(rect, 1024, 768);
    expect(origin.translateX).toBeCloseTo(264 + 372 - 512);
  });

  it("monte du bas de l'écran sans pastille mesurée", () => {
    expect(sheetOrigin(null, 390, 844)).toEqual({ translateY: 844, scaleX: 1, translateX: 0 });
    expect(phoneMiniRect(390, 844, 83, 0, 8)).toBeNull();
    expect(sheetOrigin({ top: 900, left: 12, width: 366 }, 390, 844).translateY).toBe(844);
  });

  it("ne montre le contenu qu'une fois la forme lancée, et l'efface d'abord à la fermeture", () => {
    expect(rangeProgress(0.2, CONTENT_FADE_RANGE)).toBe(0);
    expect(rangeProgress(0.6, CONTENT_FADE_RANGE)).toBeCloseTo(0.5);
    expect(rangeProgress(1, CONTENT_FADE_RANGE)).toBe(1);
    // Une progression qui dépasse (ressort) reste bornée.
    expect(rangeProgress(1.08, CONTENT_FADE_RANGE)).toBe(1);
    expect(sheetFrame(sheetOrigin(null, 390, 844), 1.08).translateY).toBe(0);
  });
});
