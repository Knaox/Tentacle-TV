/**
 * La luminance de ce qui est SOUS une surface de verre — pour que ses glyphes
 * s'adaptent au contenu (sombres sur un dessous clair, et inversement), comme
 * le Liquid Glass d'Apple. La page ne peut pas lire ses propres pixels ; le
 * principal le peut (`sampler.ts` : `webContents.capturePage`, et la vidéo de
 * mpv par `videoSample.ts` là où la page est transparente).
 *
 * Pur, sans Electron : les captures arrivent ici en BGRA prémultiplié (le format
 * de `toBitmap()` sur macOS ; la grille de la vidéo, opaque, de `videoSample.ts`)
 * et ne repartent qu'en NOMBRES — jamais un pixel ne traverse le pont.
 */

/** Un rectangle, en pixels de l'image ou en points selon l'appelant. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Côté de la grille d'échantillons par rectangle : 16 × 16 suffisent à une médiane. */
export const SAMPLE_GRID = 16;
/** En deçà, le pixel est transparent : la page n'y peint rien, il ne dit rien du dessous. */
const OPAQUE_ALPHA = 128;

/** Une composante sRGB 8 bits, linéarisée (0..1). */
export function linearize(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative (0..1) d'un pixel sRGB 8 bits — la définition du WCAG. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** La médiane, `null` sans valeur. La médiane plutôt que la moyenne : les glyphes de la surface ne la tirent pas. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? null) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Les échantillons d'une grille `grid` × `grid` sur `box` (pixels de l'image) :
 * `grid² × 4` octets BGRA, un point au CENTRE de chaque case, ligne par ligne
 * depuis le haut. Un point hors de l'image est transparent (0, 0, 0, 0) : la
 * grille garde sa place sur la boîte ENTIÈRE, si bien que la page et la vidéo
 * (`videoSample.ts`), capturées chacune dans son repère, se composent case à
 * case. `null` si la boîte est vide.
 */
export function gridSamples(bgra: Uint8Array, imageWidth: number, imageHeight: number, box: Box, grid = SAMPLE_GRID): Uint8Array | null {
  if (!(box.width > 0 && box.height > 0)) return null;
  const samples = new Uint8Array(grid * grid * 4);
  for (let j = 0; j < grid; j += 1) {
    const y = Math.floor(box.y + ((j + 0.5) * box.height) / grid);
    if (y < 0 || y >= imageHeight) continue;
    for (let i = 0; i < grid; i += 1) {
      const x = Math.floor(box.x + ((i + 0.5) * box.width) / grid);
      if (x < 0 || x >= imageWidth) continue;
      const p = (y * imageWidth + x) * 4;
      samples.set(bgra.subarray(p, p + 4), (j * grid + i) * 4);
    }
  }
  return samples;
}

/** Médiane de la luminance des échantillons, les transparents ignorés ; `null` sans rien d'opaque. */
export function medianOfSamples(samples: Uint8Array): number | null {
  const values: number[] = [];
  for (let p = 0; p + 3 < samples.length; p += 4) {
    if ((samples[p + 3] ?? 0) < OPAQUE_ALPHA) continue;
    values.push(relativeLuminance(samples[p + 2] ?? 0, samples[p + 1] ?? 0, samples[p] ?? 0));
  }
  return median(values);
}

/**
 * Médiane de la luminance sur une grille `grid` × `grid` dans `box` (pixels de
 * l'image), en ignorant les pixels transparents. `null` si rien d'opaque.
 */
export function medianLuminance(bgra: Uint8Array, imageWidth: number, imageHeight: number, box: Box, grid = SAMPLE_GRID): number | null {
  const samples = gridSamples(bgra, imageWidth, imageHeight, box, grid);
  return samples === null ? null : medianOfSamples(samples);
}

/** La page laisse-t-elle voir le dessous quelque part (un échantillon pas pleinement opaque) ? */
export function seesThrough(samples: Uint8Array): boolean {
  for (let p = 3; p < samples.length; p += 4) if ((samples[p] ?? 0) < 255) return true;
  return false;
}

/**
 * La page posée sur la vidéo, échantillon par échantillon : ce que l'œil voit
 * sous les glyphes, au verre natif près (`clear` : −15 % de luminance mesurés).
 *
 * Les deux grilles sont PRÉMULTIPLIÉES : « source sur destination » s'écrit
 * page + vidéo × (1 − alpha de la page), dans l'espace sRGB encodé où Chromium
 * compose lui-même. Un échantillon de vidéo transparent (hors de la fenêtre de
 * mpv : le bandeau, une marge) ne compose rien — la page y reste telle quelle.
 */
export function compositeOver(page: Uint8Array, video: Uint8Array): Uint8Array {
  const out = new Uint8Array(page.length);
  for (let p = 0; p + 3 < page.length; p += 4) {
    const alpha = page[p + 3] ?? 0;
    if ((video[p + 3] ?? 0) < OPAQUE_ALPHA) {
      out.set(page.subarray(p, p + 4), p);
      continue;
    }
    const rest = 1 - alpha / 255;
    for (let c = 0; c < 3; c += 1) out[p + c] = Math.min(255, Math.round((page[p + c] ?? 0) + (video[p + c] ?? 0) * rest));
    out[p + 3] = 255;
  }
  return out;
}

/** Le plus petit rectangle qui contient tous les autres. */
export function unionBox(boxes: readonly Box[]): Box {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.width));
  const y1 = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Le facteur de réduction de la capture : assez petit pour ne pas recopier
 * l'écran entier, assez grand pour que le plus petit rectangle garde une
 * grille complète. Jamais d'agrandissement.
 */
export function reductionFor(boxes: readonly Box[], grid = SAMPLE_GRID): number {
  const smallest = Math.min(...boxes.map((b) => Math.min(b.width, b.height)));
  return smallest <= 0 ? 1 : Math.min(1, Math.max(grid / smallest, 0.125));
}
