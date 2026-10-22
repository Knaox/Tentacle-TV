import { describe, expect, it } from "vitest";
import { medianOfSamples, relativeLuminance } from "./luminance";
import { displayAspect, gridPoints, videoLayout, videoSamples, type VideoLayout } from "./videoLayout";

// Le banc du 22/10 : fenêtre mpv de 1280 × 778 pt sous un bandeau de 22 pt, image 16:9
// ajustée en 1280 × 720 (bandes de 29 pt en haut et en bas).
const WINDOW = { x: 0, y: 22, width: 1280, height: 778 };
const layout = videoLayout(WINDOW, 16 / 9) as VideoLayout;

/** Une image de hauteur `h` : moitié haute claire (0xF2), moitié basse sombre (0x1A), en mots BGRA. */
const halves = (h: number) => (_x: number, y: number): number => {
  const v = y < h / 2 ? 0xf2 : 0x1a;
  return (255 << 24) | (v << 16) | (v << 8) | v;
};

describe("displayAspect / videoLayout", () => {
  it("lit l'aspect affiché de video-params tel que le pont le rend, rotation comprise", () => {
    expect(displayAspect('{"w":1280,"h":720,"dw":1280,"dh":720,"aspect":1.777778}')).toBeCloseTo(16 / 9, 9);
    // DVD anamorphosé : 720 × 480 stockés, 853 × 480 affichés.
    expect(displayAspect('{"w":720,"h":480,"dw":853,"dh":480}')).toBeCloseTo(853 / 480, 9);
    expect(displayAspect('{"dw":1920,"dh":1080,"rotate":90}')).toBeCloseTo(1080 / 1920, 9);
    expect(displayAspect(null)).toBeNull();
    expect(displayAspect("pas du json")).toBeNull();
    expect(displayAspect('{"w":0,"h":0}')).toBeNull();
  });

  it("une image plus large que la fenêtre : bandes en haut et en bas, centrée", () => {
    expect(layout.x0).toBe(0);
    expect(layout.x1).toBe(1);
    expect(layout.y0 * 778).toBeCloseTo(29, 6);
    expect(layout.y1 * 778).toBeCloseTo(749, 6);
  });

  it("une image plus étroite : bandes à gauche et à droite ; rien sans image", () => {
    const tall = videoLayout(WINDOW, 4 / 3) as VideoLayout;
    expect(tall.y0).toBe(0);
    expect(tall.x0 * 1280).toBeCloseTo((1280 - 778 * (4 / 3)) / 2, 6);
    expect(videoLayout(WINDOW, 0)).toBeNull();
    expect(videoLayout({ ...WINDOW, height: 0 }, 16 / 9)).toBeNull();
  });
});

describe("gridPoints / videoSamples", () => {
  it("un rectangle au-dessus de la fenêtre (le bandeau) ne dit rien : transparent", () => {
    const points = gridPoints(layout, { x: 100, y: 0, width: 200, height: 20 });
    expect(points.every((p) => p.kind === "outside")).toBe(true);
    expect(medianOfSamples(videoSamples(points, 1280, 720, halves(720)))).toBeNull();
  });

  it("une bande noire de cadrage se voit noire et opaque", () => {
    const points = gridPoints(layout, { x: 100, y: 24, width: 200, height: 12 });
    expect(points.every((p) => p.kind === "bar")).toBe(true);
    expect(medianOfSamples(videoSamples(points, 1280, 720, halves(720)))).toBe(0);
  });

  it("le haut de la page lit le haut de l'image : le sens vertical tient (la « neige » en haut)", () => {
    const top = videoSamples(gridPoints(layout, { x: 100, y: 80, width: 200, height: 56 }), 1280, 720, halves(720));
    const bottom = videoSamples(gridPoints(layout, { x: 100, y: 700, width: 200, height: 56 }), 1280, 720, halves(720));
    expect(medianOfSamples(top)).toBeCloseTo(relativeLuminance(0xf2, 0xf2, 0xf2), 6);
    expect(medianOfSamples(bottom)).toBeCloseTo(relativeLuminance(0x1a, 0x1a, 0x1a), 6);
  });

  it("lit chaque point à sa fraction de l'image, BGRA dans l'ordre, et rien d'autre", () => {
    const seen: Array<[number, number]> = [];
    const blue = (x: number, y: number): number => {
      seen.push([x, y]);
      return (255 << 24) | 255; // B = 255, G = R = 0
    };
    const samples = videoSamples(gridPoints(layout, { x: 0, y: 51, width: 1280, height: 720 }, 2), 1920, 1080, blue);
    expect(Array.from(samples.subarray(0, 4))).toEqual([255, 0, 0, 255]);
    // Quatre points, au centre de chaque quart de l'image — au pixel près (arrondi flottant).
    const expected = [[480, 270], [1440, 270], [480, 810], [1440, 810]];
    expect(seen).toHaveLength(4);
    seen.forEach(([x, y], k) => {
      expect(Math.abs(x - (expected[k]?.[0] ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs(y - (expected[k]?.[1] ?? 0))).toBeLessThanOrEqual(1);
    });
  });

  it("une grille à cheval sur la fenêtre et le bandeau garde sa place : chaque point à sa case", () => {
    const points = gridPoints(layout, { x: 0, y: 0, width: 1280, height: 88 }, 4);
    expect(points.slice(0, 4).every((p) => p.kind === "outside")).toBe(true);
    expect(points.slice(12, 16).every((p) => p.kind === "frame")).toBe(true);
  });
});
