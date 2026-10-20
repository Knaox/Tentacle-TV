import { describe, expect, it } from "vitest";
import { groupPanelLayout, videoHeightAbove } from "./groupPanelLayout";

const TABLET = 700;

describe("groupPanelLayout", () => {
  it("iPad : deux colonnes en paysage, panneau dessous en portrait", () => {
    expect(groupPanelLayout(1180, 820, TABLET)).toBe("side");
    expect(groupPanelLayout(820, 1180, TABLET)).toBe("below");
  });

  it("téléphone : panneau superposé en paysage, feuille en portrait", () => {
    expect(groupPanelLayout(932, 430, TABLET)).toBe("overlay");
    expect(groupPanelLayout(430, 932, TABLET)).toBe("sheet");
  });

  it("un iPad réduit en Split View retombe sur le téléphone", () => {
    expect(groupPanelLayout(390, 1024, TABLET)).toBe("sheet");
  });
});

describe("videoHeightAbove", () => {
  it("16:9 sur la largeur, jamais plus de la moitié de la hauteur", () => {
    expect(videoHeightAbove(820, 1180)).toBe(461);
    expect(videoHeightAbove(1000, 1000)).toBe(500);
  });
});
