import { describe, expect, it } from "vitest";
import { linearize, median, medianLuminance, reductionFor, relativeLuminance, unionBox } from "./luminance";

/** Une image BGRA unie de `w` × `h`, avec quelques pixels « glyphes » posés par `paint`. */
function image(w: number, h: number, bgra: [number, number, number, number], paint?: (x: number, y: number) => [number, number, number, number] | null) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const p = (y * w + x) * 4;
    const color = paint?.(x, y) ?? bgra;
    data.set(color, p);
  }
  return data;
}

describe("luminance relative", () => {
  it("noir 0, blanc 1, et le vert pèse le plus lourd", () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 6);
    expect(relativeLuminance(0, 255, 0)).toBeCloseTo(0.7152, 4);
    expect(linearize(128)).toBeCloseTo(0.2159, 3);
  });

  it("médiane, paire ou impaire, et null sans valeur", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("medianLuminance", () => {
  it("un fond blanc reste blanc malgré des glyphes noirs (la médiane ne se laisse pas tirer)", () => {
    // Fond blanc, un tiers de pixels noirs : la moyenne tomberait, la médiane non.
    const data = image(64, 32, [255, 255, 255, 255], (x) => (x % 3 === 0 ? [0, 0, 0, 255] : null));
    expect(medianLuminance(data, 64, 32, { x: 0, y: 0, width: 64, height: 32 })).toBeCloseTo(1, 4);
  });

  it("lit le BGRA dans le bon ordre", () => {
    // BGRA : (B=255, G=0, R=0) est un bleu pur, luminance 0,0722.
    const blue = image(16, 16, [255, 0, 0, 255]);
    expect(medianLuminance(blue, 16, 16, { x: 0, y: 0, width: 16, height: 16 })).toBeCloseTo(0.0722, 4);
  });

  it("ignore le transparent : au-dessus de la vidéo, rien à dire (null)", () => {
    const clear = image(32, 32, [255, 255, 255, 0]);
    expect(medianLuminance(clear, 32, 32, { x: 0, y: 0, width: 32, height: 32 })).toBeNull();
  });

  it("un rectangle hors de l'image ne dit rien", () => {
    const data = image(10, 10, [0, 0, 0, 255]);
    expect(medianLuminance(data, 10, 10, { x: 20, y: 20, width: 5, height: 5 })).toBeNull();
  });
});

describe("unionBox / reductionFor", () => {
  it("l'union couvre tout", () => {
    expect(unionBox([{ x: 10, y: 20, width: 30, height: 10 }, { x: 0, y: 50, width: 5, height: 5 }])).toEqual({ x: 0, y: 20, width: 40, height: 35 });
  });

  it("réduit sans jamais agrandir, et garde 16 px au plus petit rectangle", () => {
    expect(reductionFor([{ x: 0, y: 0, width: 400, height: 64 }])).toBe(0.25);
    expect(reductionFor([{ x: 0, y: 0, width: 10, height: 10 }])).toBe(1);
    expect(reductionFor([{ x: 0, y: 0, width: 1280, height: 800 }])).toBe(0.125);
  });
});
