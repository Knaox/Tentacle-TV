import { describe, expect, it } from "vitest";
import { LITE_BACKDROP_WIDTH, backdropWidthFor } from "./liteImages";

describe("backdropWidthFor — les fonds plein écran du mode Lite", () => {
  it("normal : la largeur demandée, telle quelle", () => {
    expect(backdropWidthFor("normal", 1920)).toBe(1920);
    expect(backdropWidthFor("normal", 1280)).toBe(1280);
  });

  it("Lite : 960 au plus (un fond en 960 × 540)", () => {
    expect(LITE_BACKDROP_WIDTH).toBe(960);
    expect(backdropWidthFor("lite", 1920)).toBe(960);
    expect(backdropWidthFor("lite", 1280)).toBe(960);
  });

  it("Lite : une demande déjà plus petite n'est jamais agrandie", () => {
    expect(backdropWidthFor("lite", 640)).toBe(640);
  });
});
