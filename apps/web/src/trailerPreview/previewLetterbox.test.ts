/**
 * La détection du letterbox incrusté, sur des images SYNTHÉTIQUES réduites
 * (64 × 144, comme le moteur les lit) : bandes noires mesurées au pixel près,
 * rognage borné au 2,4:1, et RIEN dans le doute — scène sombre, logo sur fond
 * noir, fondu au noir, piliers d'une 4:3, image illisible.
 */
import { describe, expect, it } from "vitest";
import { letterboxContentShare, letterboxCropScale, type FramePixels } from "./previewLetterbox";

const W = 64;
const H = 144;
const WIDE = { sourceAspect: 16 / 9, boxAspect: 16 / 9 };

/** Une image dont `pixel(x, y)` donne le niveau (gris) ; une image « vivante » par défaut. */
function frame(pixel: (x: number, y: number) => number, width = W, height = H): FramePixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = pixel(x, y);
      data.set([v, v, v, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

const content = (x: number, y: number) => 70 + ((x * 7 + y * 3) % 120);
/** Des bandes noires de `bars` lignes (fraction possible : la ligne de passage est mélangée). */
const letterbox = (bars: number) => frame((x, y) => {
  const fromEdge = Math.min(y, H - 1 - y);
  if (fromEdge < Math.floor(bars)) return 0;
  if (fromEdge === Math.floor(bars)) return Math.round(content(x, y) * (1 - (bars - Math.floor(bars))));
  return content(x, y);
});

describe("letterboxCropScale — ce qui se rogne", () => {
  it("une image sans bandes : rien", () => {
    expect(letterboxCropScale(frame(content), WIDE)).toBe(1);
  });

  it("un 2,39:1 dans du 16:9 (bandes de 12,8 %) : ~1,344, la ligne de passage comprise", () => {
    const bars = (H * (1 - (16 / 9) / 2.39)) / 2;
    expect(letterboxCropScale(letterbox(bars), WIDE)).toBeCloseTo(1.344, 2);
  });

  it("un 2:1 : 1,125", () => {
    expect(letterboxCropScale(letterbox((H * (1 - (16 / 9) / 2)) / 2), WIDE)).toBeCloseTo(1.125, 2);
  });

  it("plus large que 2,4:1 : bornée au 2,4:1 — on garde des bandes plutôt que de couper l'image", () => {
    expect(letterboxCropScale(letterbox((H * (1 - (16 / 9) / 2.76)) / 2), WIDE)).toBeCloseTo(2.4 / (16 / 9), 2);
  });

  it("une source 4:3 dont l'image utile est en 16:9 : `cover` la rogne déjà, presque rien de plus", () => {
    const bars = (H * (1 - (4 / 3) / (16 / 9))) / 2;
    expect(letterboxCropScale(letterbox(bars), { sourceAspect: 4 / 3, boxAspect: 16 / 9 })).toBeLessThan(1.02);
  });
});

describe("letterboxCropScale — dans le doute, rien", () => {
  it("un logo sur fond noir (bandes « symétriques », mais l'image ne touche pas les bords)", () => {
    const logo = frame((x, y) => (x > 20 && x < 44 && y > 50 && y < 94 ? 200 : 0));
    expect(letterboxContentShare(logo)).toBeNull();
    expect(letterboxCropScale(logo, WIDE)).toBe(1);
  });

  it("une scène sombre en haut seulement, une image entièrement noire, des bandes inégales", () => {
    expect(letterboxCropScale(frame((x, y) => (y < 30 ? 0 : content(x, y))), WIDE)).toBe(1);
    expect(letterboxCropScale(frame(() => 0), WIDE)).toBe(1);
    expect(letterboxCropScale(frame((x, y) => (y < 10 || y > H - 22 ? 0 : content(x, y))), WIDE)).toBe(1);
  });

  it("une nuit (un noir texturé, pas un noir d'encodage) n'est pas une bande", () => {
    const night = frame((x, y) => (y < 18 || y >= H - 18 ? 5 + ((x * 13 + y) % 20) : content(x, y)));
    expect(letterboxCropScale(night, WIDE)).toBe(1);
  });

  it("des piliers gauche et droit (une 4:3 dans du 16:9) : jamais rognés", () => {
    expect(letterboxCropScale(frame((x, y) => (x < 8 || x >= W - 8 ? 0 : content(x, y))), WIDE)).toBe(1);
  });

  it("une image illisible ou tronquée", () => {
    expect(letterboxCropScale({ data: new Uint8ClampedArray(10), width: W, height: H }, WIDE)).toBe(1);
    expect(letterboxCropScale(letterbox(18), { sourceAspect: 0, boxAspect: 16 / 9 })).toBe(1);
  });
});
