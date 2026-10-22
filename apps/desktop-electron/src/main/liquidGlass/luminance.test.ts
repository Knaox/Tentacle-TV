import { describe, expect, it } from "vitest";
import { compositeOver, gridSamples, linearize, median, medianLuminance, medianOfSamples, reductionFor, relativeLuminance, seesThrough, unionBox } from "./luminance";

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

/** Une grille de `n` échantillons, tous de la même couleur BGRA. */
function samples(n: number, bgra: [number, number, number, number]): Uint8Array {
  const data = new Uint8Array(n * 4);
  for (let p = 0; p < data.length; p += 4) data.set(bgra, p);
  return data;
}

describe("gridSamples / medianOfSamples", () => {
  it("un point au centre de chaque case, ligne par ligne depuis le haut", () => {
    // Moitié haute blanche, moitié basse noire : la première ligne de la grille est blanche.
    const data = image(32, 32, [0, 0, 0, 255], (_x, y) => (y < 16 ? [255, 255, 255, 255] : null));
    const grid = gridSamples(data, 32, 32, { x: 0, y: 0, width: 32, height: 32 }, 4);
    expect(grid).not.toBeNull();
    expect(Array.from(grid?.subarray(0, 4) ?? [])).toEqual([255, 255, 255, 255]);
    expect(Array.from(grid?.subarray(12 * 4, 12 * 4 + 4) ?? [])).toEqual([0, 0, 0, 255]);
  });

  it("medianLuminance est la médiane des échantillons de la grille", () => {
    const data = image(64, 32, [255, 255, 255, 255], (x) => (x % 3 === 0 ? [0, 0, 0, 255] : null));
    const box = { x: 0, y: 0, width: 64, height: 32 };
    const grid = gridSamples(data, 64, 32, box);
    expect(grid === null ? null : medianOfSamples(grid)).toBe(medianLuminance(data, 64, 32, box));
  });
});

describe("seesThrough / compositeOver — la page posée sur la vidéo", () => {
  it("une page pleinement opaque ne laisse rien voir ; un seul point transparent suffit", () => {
    const opaque = samples(256, [10, 20, 30, 255]);
    expect(seesThrough(opaque)).toBe(false);
    opaque[3] = 254;
    expect(seesThrough(opaque)).toBe(true);
  });

  it("page transparente sur une vidéo claire : la luminance de la vidéo (le cas « neige »)", () => {
    const snow = samples(256, [242, 242, 242, 255]);
    const result = medianOfSamples(compositeOver(samples(256, [0, 0, 0, 0]), snow));
    expect(result).toBeCloseTo(relativeLuminance(242, 242, 242), 6);
    expect(result).toBeGreaterThan(0.85);
  });

  it("des glyphes opaques minoritaires ne tirent pas la médiane : c'est le dessous qui compte", () => {
    // 20 % de glyphes blancs opaques sur une vidéo sombre.
    const page = samples(256, [0, 0, 0, 0]);
    for (let k = 0; k < 51; k += 1) page.set([255, 255, 255, 255], k * 4);
    const dark = samples(256, [20, 20, 20, 255]);
    expect(medianOfSamples(compositeOver(page, dark))).toBeCloseTo(relativeLuminance(20, 20, 20), 6);
  });

  it("compose en prémultiplié : page + vidéo × (1 − alpha)", () => {
    // Un voile noir à 50 % (prémultiplié : 0,0,0,128) sur du blanc donne ~127.
    const out = compositeOver(samples(1, [0, 0, 0, 128]), samples(1, [255, 255, 255, 255]));
    expect(Array.from(out)).toEqual([127, 127, 127, 255]);
    // Un blanc à 50 % prémultiplié (128,128,128,128) sur du noir reste 128.
    expect(Array.from(compositeOver(samples(1, [128, 128, 128, 128]), samples(1, [0, 0, 0, 255])))).toEqual([128, 128, 128, 255]);
  });

  it("hors de la fenêtre de mpv (vidéo transparente), la page reste telle quelle", () => {
    const page = samples(4, [0, 0, 0, 0]);
    expect(medianOfSamples(compositeOver(page, samples(4, [0, 0, 0, 0])))).toBeNull();
    const banner = samples(4, [5, 5, 5, 255]);
    expect(Array.from(compositeOver(banner, samples(4, [0, 0, 0, 0])))).toEqual(Array.from(banner));
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
