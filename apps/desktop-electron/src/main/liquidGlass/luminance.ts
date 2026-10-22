/**
 * La luminance de ce qui est SOUS une surface de verre — pour que ses glyphes
 * s'adaptent au contenu (sombres sur un dessous clair, et inversement), comme
 * le Liquid Glass d'Apple. La page ne peut pas lire ses propres pixels ; le
 * principal le peut (`sampler.ts`, `webContents.capturePage`).
 *
 * Pur, sans Electron : la capture arrive ici en BGRA (le format de `toBitmap()`
 * sur macOS) et ne repart qu'en NOMBRES — jamais un pixel ne traverse le pont.
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
 * Médiane de la luminance sur une grille `grid` × `grid` dans `box` (pixels de
 * l'image), en ignorant les pixels transparents. `null` si rien d'opaque :
 * au-dessus de la vidéo, la page est transparente et la capture ne voit pas mpv.
 */
export function medianLuminance(bgra: Uint8Array, imageWidth: number, imageHeight: number, box: Box, grid = SAMPLE_GRID): number | null {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(imageWidth, Math.ceil(box.x + box.width));
  const y1 = Math.min(imageHeight, Math.ceil(box.y + box.height));
  if (x1 <= x0 || y1 <= y0) return null;
  const values: number[] = [];
  for (let j = 0; j < grid; j += 1) {
    const y = Math.min(y1 - 1, Math.floor(y0 + ((j + 0.5) * (y1 - y0)) / grid));
    for (let i = 0; i < grid; i += 1) {
      const x = Math.min(x1 - 1, Math.floor(x0 + ((i + 0.5) * (x1 - x0)) / grid));
      const p = (y * imageWidth + x) * 4;
      if ((bgra[p + 3] ?? 0) < OPAQUE_ALPHA) continue;
      values.push(relativeLuminance(bgra[p + 2] ?? 0, bgra[p + 1] ?? 0, bgra[p] ?? 0));
    }
  }
  return median(values);
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
