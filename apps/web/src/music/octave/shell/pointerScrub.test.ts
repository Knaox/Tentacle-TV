import { describe, expect, it } from "vitest";
import { pointerRatio, pointerValue } from "./pointerScrub";

/** Un clic sur la barre va EXACTEMENT où il tombe, quelle que soit la place du rail dans la fenêtre. */
describe("pointerScrub", () => {
  const rail = { left: 312.5, width: 400 };

  it("la fraction du rail dessiné, au pixel près", () => {
    expect(pointerRatio(312.5, rail)).toBe(0);
    expect(pointerRatio(512.5, rail)).toBe(0.5);
    expect(pointerRatio(712.5, rail)).toBe(1);
    expect(pointerRatio(412.5, rail)).toBe(0.25);
  });

  it("bornée hors du rail, nulle sans largeur", () => {
    expect(pointerRatio(100, rail)).toBe(0);
    expect(pointerRatio(900, rail)).toBe(1);
    expect(pointerRatio(500, { left: 0, width: 0 })).toBe(0);
    expect(pointerRatio(Number.NaN, rail)).toBe(0);
  });

  it("la valeur sans arrondi au pas : 3 min 30 de 4 min 00 au 7/8 du rail", () => {
    expect(pointerValue(312.5 + 350, rail, 0, 240_000)).toBe(210_000);
    expect(pointerValue(312.5 + 1, rail, 0, 240_000)).toBe(600);
  });
});
