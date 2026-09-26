import { describe, expect, it } from "vitest";
import { resolveFormFactor } from "./formFactor";
import { contentPadding, gridLayout, heroMetrics, rowCardWidth } from "./responsive";

const touch = (width: number, height: number) => ({ width, height, touchPrimary: true, desktopShell: false });
const mouse = (width: number, height: number) => ({ width, height, touchPrimary: false, desktopShell: false });

describe("resolveFormFactor", () => {
  it("l'app de bureau reste le bureau, même en fenêtre étroite ou tactile", () => {
    expect(resolveFormFactor({ ...mouse(500, 800), desktopShell: true })).toBe("desktop");
    expect(resolveFormFactor({ ...touch(820, 1180), desktopShell: true })).toBe("desktop");
  });

  it("l'iPad est une tablette dans les deux sens, sur le petit côté", () => {
    expect(resolveFormFactor(touch(820, 1180))).toBe("tablet");
    expect(resolveFormFactor(touch(1180, 820))).toBe("tablet");
    expect(resolveFormFactor(touch(744, 1133))).toBe("tablet"); // iPad mini
    expect(resolveFormFactor(touch(1366, 1024))).toBe("tablet"); // iPad Pro 12,9
  });

  it("un téléphone tactile reste un téléphone couché", () => {
    expect(resolveFormFactor(touch(390, 844))).toBe("phone");
    expect(resolveFormFactor(touch(932, 430))).toBe("phone");
  });

  it("à la souris : téléphone jusqu'à 768 px, bureau au-delà — jamais tablette", () => {
    expect(resolveFormFactor(mouse(768, 900))).toBe("phone");
    expect(resolveFormFactor(mouse(769, 900))).toBe("desktop");
    expect(resolveFormFactor(mouse(1180, 820))).toBe("desktop");
  });
});

describe("mesures de l'app mobile", () => {
  it("grille : 3 colonnes au téléphone, dérivées d'une cible de 150 sur tablette", () => {
    expect(gridLayout(390, 0, { phoneColumns: 3 }).numColumns).toBe(3);
    expect(gridLayout(820, 0, { phoneColumns: 3 }).numColumns).toBe(5);
    expect(gridLayout(1024, 0, { phoneColumns: 3 }).numColumns).toBe(6);
    expect(gridLayout(1366, 76, { phoneColumns: 3 }).numColumns).toBe(8);
  });

  it("colonne centrée : 16 tant qu'elle tient, marges égales au-delà", () => {
    expect(contentPadding(390, 0)).toBe(16);
    expect(contentPadding(820, 0)).toBe(90);
    expect(contentPadding(1180, 76, 720)).toBe(192);
  });

  it("cartes de rangée 130 / 168 × densité", () => {
    expect(rowCardWidth(false)).toBe(130);
    expect(rowCardWidth(true)).toBe(168);
    expect(rowCardWidth(false, "large")).toBe(156);
  });

  it("hero : affiche au téléphone, visuel large sur l'iPad portrait", () => {
    expect(heroMetrics(390, 844, 0, false)).toMatchObject({ bannerH: 625, slideW: 358, portrait: true });
    expect(heroMetrics(820, 1180, 0, true)).toMatchObject({ bannerH: 820, portrait: false });
  });
});
