/**
 * Les sept classes de vignettes, sur les mesures relevées au banc — et la
 * mesure elle-même, sur des planches fabriquées pixel par pixel.
 */

import { describe, expect, it } from "vitest";
import { classifyCell, measureCell, type ThumbnailMeasure } from "./tailCells";

const m = (over: Partial<ThumbnailMeasure>): ThumbnailMeasure => ({
  ms: 0, dark: 0.1, saturation: 60, rows: 0, modal: 0.2, ...over,
});

describe("classifyCell", () => {
  it("un défilement sur noir, même assez dense pour éclaircir l'image (« Endgame »)", () => {
    expect(classifyCell(m({ dark: 0.92, rows: 0.35, modal: 0.9, saturation: 1 }))).toBe("T");
    expect(classifyCell(m({ dark: 0.56, rows: 0.5, modal: 0.5, saturation: 3 }))).toBe("T");
  });

  it("du texte sur fond uni coloré : L (« Les Nouveaux Héros »)", () => {
    expect(classifyCell(m({ dark: 0.02, rows: 0.3, modal: 0.7, saturation: 90 }))).toBe("L");
  });

  it("un carton sur noir, quelle que soit la couleur du texte (le jaune de « Joker »)", () => {
    expect(classifyCell(m({ dark: 0.95, rows: 0.05, modal: 0.95, saturation: 12 }))).toBe("C");
  });

  it("le noir pur : K — mais une nuit presque noire garde sa couleur : D (« Les Gardiens 3 », 110:40)", () => {
    expect(classifyCell(m({ dark: 1, rows: 0, modal: 1, saturation: 0 }))).toBe("K");
    expect(classifyCell(m({ dark: 0.99, rows: 0, modal: 0.96, saturation: 2.4 }))).toBe("D");
    expect(classifyCell(m({ dark: 0.7, rows: 0.01, modal: 0.6, saturation: 8 }))).toBe("D");
  });

  it("un aplat : U (les cartons rouges de « Deadpool ») ; le reste : E", () => {
    expect(classifyCell(m({ dark: 0, rows: 0.01, modal: 0.9, saturation: 150 }))).toBe("U");
    expect(classifyCell(m({}))).toBe("E");
    // Des lumières piquées sur un fond texturé : des rangées, mais ni noir ni fond uni.
    expect(classifyCell(m({ dark: 0.3, rows: 0.4, modal: 0.3 }))).toBe("E");
  });
});

/** Une planche RGBA de `cols` × `rows` cellules de 32 × 18, remplie par `paint`. */
function sheet(cols: number, rowsCount: number, paint: (cell: number, x: number, y: number) => [number, number, number]) {
  const w = 32;
  const h = 18;
  const width = cols * w;
  const pixels = new Uint8Array(width * rowsCount * h * 4);
  for (let cell = 0; cell < cols * rowsCount; cell++) {
    const ox = (cell % cols) * w;
    const oy = Math.floor(cell / cols) * h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((oy + y) * width + ox + x) * 4;
        const [r, g, b] = paint(cell, x, y);
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = 255;
      }
    }
  }
  return { pixels, width, w, h };
}

describe("measureCell", () => {
  it("mesure chaque cellule à sa place dans la planche", () => {
    // Cellule 0 : noir, avec une ligne de texte blanc sur deux rangées sur trois.
    // Cellule 1 : gris uni. Cellule 2 : rouge vif.
    const { pixels, width, w, h } = sheet(3, 1, (cell, x, y) => {
      if (cell === 0) return y % 3 !== 2 && x % 4 === 1 ? [255, 255, 255] : [0, 0, 0];
      if (cell === 1) return [128, 128, 128];
      return [220, 20, 20];
    });
    const text = measureCell(pixels, width, 0, 0, w, h, 10_000);
    expect(text.ms).toBe(10_000);
    expect(text.rows).toBeCloseTo(12 / 18, 5);
    expect(text.dark).toBeCloseTo(1 - (12 * 8) / (32 * 18), 5);
    expect(text.saturation).toBe(0);
    expect(classifyCell(text)).toBe("T");

    const grey = measureCell(pixels, width, w, 0, w, h, 20_000);
    expect(grey).toMatchObject({ dark: 0, rows: 0, modal: 1, saturation: 0 });
    expect(classifyCell(grey)).toBe("U");

    const red = measureCell(pixels, width, 2 * w, 0, w, h, 30_000);
    expect(red.saturation).toBe(200);
    expect(red.modal).toBe(1);
  });
});
