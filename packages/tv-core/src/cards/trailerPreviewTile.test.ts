import { describe, expect, it } from "vitest";
import { trailerPreviewScrollTarget, trailerPreviewTileSize } from "./trailerPreviewTile";

const SCREEN = { screenWidth: 1920, maxWidth: 1920 - 176 - 96 };

describe("trailerPreviewTileSize — la grande carte de l'aperçu", () => {
  it("une vignette (380 × 214) devient une grande vignette 16:9 d'environ 42 % de l'écran", () => {
    expect(trailerPreviewTileSize({ cardWidth: 380, cardHeight: 214, ...SCREEN })).toEqual({ width: 806, height: 453 });
  });

  it("une affiche (240 × 360) prend la même taille, jamais moins haute qu'elle", () => {
    const tile = trailerPreviewTileSize({ cardWidth: 240, cardHeight: 360, ...SCREEN });
    expect(tile).toEqual({ width: 806, height: 453 });
    expect(tile.height).toBeGreaterThanOrEqual(360);
  });

  it("une carte réglée plus grande grandit encore (1,5 × sa largeur)", () => {
    expect(trailerPreviewTileSize({ cardWidth: 640, cardHeight: 360, ...SCREEN }).width).toBe(960);
  });

  it("une très grande affiche grandit d'après sa HAUTEUR : la vidéo la couvre", () => {
    expect(trailerPreviewTileSize({ cardWidth: 340, cardHeight: 510, ...SCREEN })).toEqual({ width: 907, height: 510 });
  });

  it("jamais plus large que la place de la rangée, jamais moins large que la carte", () => {
    expect(trailerPreviewTileSize({ cardWidth: 1200, cardHeight: 675, screenWidth: 1920, maxWidth: 1500 }).width).toBe(1500);
    expect(trailerPreviewTileSize({ cardWidth: 900, cardHeight: 506, screenWidth: 1920, maxWidth: 600 }).width).toBe(900);
  });
});

describe("trailerPreviewScrollTarget — la grande carte se montre entière", () => {
  const base = { cardWidth: 380, gap: 36, inset: 176, viewportWidth: 1920, rightMargin: 96, tileWidth: 806 };

  it("une carte qui a la place de grandir ne fait rien défiler", () => {
    expect(trailerPreviewScrollTarget({ ...base, index: 0, scrollX: 0 })).toBeNull();
    expect(trailerPreviewScrollTarget({ ...base, index: 1, scrollX: 0 })).toBeNull();
  });

  it("une carte trop à droite vient se poser au retrait de la rangée", () => {
    // Troisième carte : 176 + 832 = 1 008, + 806 = 1 814 ≤ 1 824 : elle tient.
    expect(trailerPreviewScrollTarget({ ...base, index: 2, scrollX: 0 })).toBeNull();
    // Quatrième : 176 + 1248 = 1424, + 806 dépasse : la rangée défile jusqu'à elle.
    expect(trailerPreviewScrollTarget({ ...base, index: 3, scrollX: 0 })).toBe(1248);
  });

  it("tient compte du défilement déjà fait", () => {
    expect(trailerPreviewScrollTarget({ ...base, index: 5, scrollX: 1664 })).toBeNull();
    expect(trailerPreviewScrollTarget({ ...base, index: 5, scrollX: 1000 })).toBe(2080);
  });

  it("une carte entamée à gauche se réaligne au retrait", () => {
    expect(trailerPreviewScrollTarget({ ...base, index: 2, scrollX: 900 })).toBe(832);
  });

  it("déjà à sa place : rien (pas de défilement pour un demi-point)", () => {
    expect(trailerPreviewScrollTarget({ ...base, index: 3, scrollX: 1248.4, tileWidth: 1700 })).toBeNull();
  });
});
