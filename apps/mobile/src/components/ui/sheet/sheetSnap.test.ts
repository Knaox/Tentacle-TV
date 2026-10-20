import { describe, expect, it } from "vitest";
import { decideSheetRelease, sheetCapturesFromContent, sheetDragOffset } from "./sheetSnap";

describe("decideSheetRelease", () => {
  it("au premier cran : vers le haut agrandit, vers le bas ferme, un petit geste reste", () => {
    expect(decideSheetRelease({ snap: 0, dy: -80, vy: -0.1, canExpand: true })).toBe("expand");
    expect(decideSheetRelease({ snap: 0, dy: 90, vy: 0.1, canExpand: true })).toBe("dismiss");
    expect(decideSheetRelease({ snap: 0, dy: -20, vy: -0.1, canExpand: true })).toBe("stay");
  });

  it("un coup bref (vitesse) suffit", () => {
    expect(decideSheetRelease({ snap: 0, dy: -20, vy: -0.9, canExpand: true })).toBe("expand");
    expect(decideSheetRelease({ snap: 0, dy: 15, vy: 0.9, canExpand: true })).toBe("dismiss");
  });

  it("une feuille sans second cran ne s'agrandit pas", () => {
    expect(decideSheetRelease({ snap: 0, dy: -200, vy: -2, canExpand: false })).toBe("stay");
  });

  it("au plein : un geste moyen redescend, un grand geste ferme, vers le haut reste", () => {
    expect(decideSheetRelease({ snap: 1, dy: 100, vy: 0.2, canExpand: true })).toBe("collapse");
    expect(decideSheetRelease({ snap: 1, dy: 300, vy: 0.2, canExpand: true })).toBe("dismiss");
    expect(decideSheetRelease({ snap: 1, dy: 60, vy: 2, canExpand: true })).toBe("dismiss");
    expect(decideSheetRelease({ snap: 1, dy: -100, vy: -1, canExpand: true })).toBe("stay");
  });

  it("une vitesse contraire à la distance ne décide pas seule", () => {
    expect(decideSheetRelease({ snap: 0, dy: -10, vy: 0.9, canExpand: true })).toBe("stay");
  });
});

describe("sheetDragOffset", () => {
  it("suit le doigt, puis résiste au-delà du plein", () => {
    expect(sheetDragOffset({ snap: 0, dy: -100, minH: 400, maxH: 800 })).toBe(300);
    expect(sheetDragOffset({ snap: 1, dy: 50, minH: 400, maxH: 800 })).toBe(50);
    expect(sheetDragOffset({ snap: 1, dy: -60, minH: 400, maxH: 800 })).toBe(-20);
  });
});

describe("sheetCapturesFromContent", () => {
  it("ignore un geste horizontal (balayage d'une ligne) ou trop court", () => {
    expect(sheetCapturesFromContent({ snap: 0, dx: 60, dy: -20, canExpand: true, scrollTop: true })).toBe(false);
    expect(sheetCapturesFromContent({ snap: 0, dx: 0, dy: -4, canExpand: true, scrollTop: true })).toBe(false);
  });

  it("au premier cran, vers le haut agrandit d'abord", () => {
    expect(sheetCapturesFromContent({ snap: 0, dx: 0, dy: -20, canExpand: true, scrollTop: null })).toBe(true);
    expect(sheetCapturesFromContent({ snap: 0, dx: 0, dy: -20, canExpand: false, scrollTop: true })).toBe(false);
  });

  it("vers le bas, seulement depuis le haut d'une liste qui le dit", () => {
    expect(sheetCapturesFromContent({ snap: 1, dx: 0, dy: 20, canExpand: true, scrollTop: true })).toBe(true);
    expect(sheetCapturesFromContent({ snap: 1, dx: 0, dy: 20, canExpand: true, scrollTop: false })).toBe(false);
    expect(sheetCapturesFromContent({ snap: 1, dx: 0, dy: 20, canExpand: true, scrollTop: null })).toBe(false);
    expect(sheetCapturesFromContent({ snap: 1, dx: 0, dy: -20, canExpand: true, scrollTop: true })).toBe(false);
  });
});
