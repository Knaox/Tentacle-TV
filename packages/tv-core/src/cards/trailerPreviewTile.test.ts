import { describe, expect, it } from "vitest";
import {
  trailerPreviewReserve,
  trailerPreviewRevealOffset,
  trailerPreviewScrollTarget,
  trailerPreviewTileFrom,
  trailerPreviewTileSize,
} from "./trailerPreviewTile";

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

  it("suit le réglage « Taille des cartes » : grande carte plus grande pour des cartes grandes, plus petite pour des petites", () => {
    // Grande (× 1,3) : vignette 494 × 278.
    expect(trailerPreviewTileSize({ cardWidth: 494, cardHeight: 278, sizeScale: 1.3, ...SCREEN })).toEqual({ width: 1048, height: 590 });
    // Grande, affiche 312 × 468 : la même grande carte, plus haute que l'affiche.
    const poster = trailerPreviewTileSize({ cardWidth: 312, cardHeight: 468, sizeScale: 1.3, ...SCREEN });
    expect(poster).toEqual({ width: 1048, height: 590 });
    // Petite (× 0,85) : vignette 323 × 182.
    expect(trailerPreviewTileSize({ cardWidth: 323, cardHeight: 182, sizeScale: 0.85, ...SCREEN })).toEqual({ width: 685, height: 385 });
  });

  it("jamais plus large que la place de la rangée, jamais moins large que la carte", () => {
    expect(trailerPreviewTileSize({ cardWidth: 1200, cardHeight: 675, screenWidth: 1920, maxWidth: 1500 }).width).toBe(1500);
    expect(trailerPreviewTileSize({ cardWidth: 900, cardHeight: 506, screenWidth: 1920, maxWidth: 600 }).width).toBe(900);
  });
});

describe("trailerPreviewScrollTarget — la grande carte se montre entière", () => {
  const base = { cardWidth: 380, gap: 36, inset: 176, viewportWidth: 1920, rightMargin: 96, tileWidth: 806, cardCount: 20 };

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

describe("trailerPreviewScrollTarget — vers la fin de la rangée", () => {
  const base = { cardWidth: 380, gap: 36, inset: 176, viewportWidth: 1920, rightMargin: 96, tileWidth: 806 };

  it("la DERNIÈRE carte : la grande carte s'arrête à la marge de droite, au bout du contenu agrandi", () => {
    // 6 cartes : 6 × 380 + 5 × 36 = 2 460 ; agrandi de 426 → 176 + 2 460 + 426 + 96 = 3 158 ; bout = 1 238.
    const target = trailerPreviewScrollTarget({ ...base, cardCount: 6, index: 5, scrollX: 812 });
    expect(target).toBe(1238);
    // Sa grande carte va de 176 + 2 080 − 1 238 = 1 018 à 1 824 : la marge de droite, pas au-delà.
    expect(176 + 5 * 416 - (target as number) + 806).toBe(1920 - 96);
  });

  it("l'avant-dernière : posée au retrait si le contenu agrandi le permet, sinon au bout", () => {
    expect(trailerPreviewScrollTarget({ ...base, cardCount: 6, index: 4, scrollX: 812 })).toBe(1238);
    expect(trailerPreviewScrollTarget({ ...base, cardCount: 9, index: 4, scrollX: 400 })).toBe(1664);
  });

  it("une rangée courte qui tient dans l'écran ne défile pas pour rien", () => {
    expect(trailerPreviewScrollTarget({ ...base, cardCount: 2, index: 1, scrollX: 0 })).toBeNull();
  });
});

describe("trailerPreviewReserve — la place à réserver avant de défiler", () => {
  it("ce que la carte s'élargit, jamais négatif", () => {
    expect(trailerPreviewReserve({ tileWidth: 806, cardWidth: 380 })).toBe(426);
    expect(trailerPreviewReserve({ tileWidth: 300, cardWidth: 380 })).toBe(0);
  });
});

describe("trailerPreviewTileFrom — la grande carte part de la carte telle qu'elle se dessine", () => {
  it("agrandie depuis le milieu de son bord haut, soulevée", () => {
    const from = trailerPreviewTileFrom({ cardWidth: 380, cardHeight: 214, focusScale: 1.08, lift: 4 });
    expect(from.left).toBeCloseTo(-15.2);
    expect(from.top).toBe(-4);
    expect(from.width).toBeCloseTo(410.4);
    expect(from.height).toBeCloseTo(231.12);
  });

  it("sans agrandissement (Lite) : la cellule même", () => {
    expect(trailerPreviewTileFrom({ cardWidth: 240, cardHeight: 360, focusScale: 1, lift: 0 })).toMatchObject({ left: 0, width: 240, height: 360 });
  });
});

describe("trailerPreviewRevealOffset — la page montre la grande carte qui grandit vers le bas", () => {
  const screen = { viewportHeight: 1080, topMargin: 54, bottomMargin: 54 };

  it("elle se voit : rien", () => {
    expect(trailerPreviewRevealOffset({ ...screen, top: 300, bottom: 900 })).toBeNull();
  });

  it("elle dépasse en bas : la page défile d'autant", () => {
    expect(trailerPreviewRevealOffset({ ...screen, top: 500, bottom: 1110 })).toBe(84);
  });

  it("jamais au point de faire passer son haut sous la marge du haut", () => {
    expect(trailerPreviewRevealOffset({ ...screen, top: 120, bottom: 1300 })).toBe(66);
    expect(trailerPreviewRevealOffset({ ...screen, top: 54, bottom: 1300 })).toBeNull();
  });
});
