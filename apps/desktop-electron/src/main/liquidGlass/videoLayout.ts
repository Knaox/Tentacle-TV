/**
 * Où tombe un rectangle de la page dans l'image que mpv a décodée — pur, testé.
 *
 * La fenêtre de mpv est posée sous la page (son cadre, en points de la vue,
 * origine en haut à gauche) ; mpv y ajuste l'image à son rapport d'aspect,
 * centrée — son cadrage par défaut (`keepaspect`, sans zoom ni `panscan`, que
 * le lecteur macOS ne touche pas ; le PiP fait la même hypothèse). ⚠️ Pas
 * `osd-dimensions` : avec l'OSD coupé (`osd-level=0`), mpv le laisse à 0 × 0
 * (mesuré). Chaque point de la grille d'un rectangle tombe alors hors de la fenêtre
 * (rien à en dire : transparent), dans une bande noire (noir opaque : c'est ce
 * qui s'y voit), ou dans l'image, à une fraction (0..1) de sa largeur et de sa
 * hauteur. Mêmes points que `gridSamples` — le centre de chaque case, ligne par
 * ligne depuis le haut —, pour que page et vidéo se composent case à case.
 */

import { SAMPLE_GRID, type Box } from "./luminance";

/** La fenêtre de mpv dans la vue, et le cadre de l'image dans la fenêtre (fractions). */
export interface VideoLayout {
  readonly window: Box;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

export type GridPoint = { readonly kind: "frame"; readonly fx: number; readonly fy: number } | { readonly kind: "bar" } | { readonly kind: "outside" };

/**
 * Le rapport d'aspect AFFICHÉ, d'après `video-params` tel que le pont le rend
 * (JSON) : `dw` / `dh` (pixels non carrés compris), retourné d'un quart de tour
 * si la vidéo l'est. `null` sans image (ouverture, recherche).
 */
export function displayAspect(raw: string | null): number | null {
  if (raw === null) return null;
  try {
    const params = JSON.parse(raw) as Record<string, unknown>;
    const width = params["dw"];
    const height = params["dh"];
    if (typeof width !== "number" || typeof height !== "number" || !(width > 0 && height > 0)) return null;
    const rotate = typeof params["rotate"] === "number" ? (params["rotate"] as number) : 0;
    return rotate % 180 === 90 ? height / width : width / height;
  } catch {
    return null;
  }
}

/** L'image d'aspect `aspect` ajustée au centre de la fenêtre ; `null` si l'un des deux est vide. */
export function videoLayout(window: Box, aspect: number): VideoLayout | null {
  if (!(aspect > 0 && window.width > 0 && window.height > 0)) return null;
  const windowAspect = window.width / window.height;
  if (aspect >= windowAspect) {
    const height = windowAspect / aspect;
    return { window, x0: 0, x1: 1, y0: (1 - height) / 2, y1: (1 + height) / 2 };
  }
  const width = aspect / windowAspect;
  return { window, x0: (1 - width) / 2, x1: (1 + width) / 2, y0: 0, y1: 1 };
}

/** Les points de la grille de `box` (points de la vue). */
export function gridPoints(layout: VideoLayout, box: Box, grid = SAMPLE_GRID): GridPoint[] {
  const points: GridPoint[] = [];
  for (let j = 0; j < grid; j += 1) {
    const wy = (box.y + ((j + 0.5) * box.height) / grid - layout.window.y) / layout.window.height;
    for (let i = 0; i < grid; i += 1) {
      const wx = (box.x + ((i + 0.5) * box.width) / grid - layout.window.x) / layout.window.width;
      if (wx < 0 || wx >= 1 || wy < 0 || wy >= 1) points.push({ kind: "outside" });
      else if (wx < layout.x0 || wx >= layout.x1 || wy < layout.y0 || wy >= layout.y1) points.push({ kind: "bar" });
      else points.push({ kind: "frame", fx: (wx - layout.x0) / (layout.x1 - layout.x0), fy: (wy - layout.y0) / (layout.y1 - layout.y0) });
    }
  }
  return points;
}

/**
 * Les échantillons BGRA de ces points dans une image `width` × `height`, lus un
 * par un : `pixel(x, y)` rend le mot de 32 bits du pixel (BGRA, petit-boutiste)
 * — la grille seule, jamais l'image entière.
 */
export function videoSamples(points: readonly GridPoint[], width: number, height: number, pixel: (x: number, y: number) => number): Uint8Array {
  const samples = new Uint8Array(points.length * 4);
  points.forEach((point, k) => {
    if (point.kind === "outside") return;
    samples[k * 4 + 3] = 255;
    if (point.kind === "bar") return;
    const word = pixel(Math.min(width - 1, Math.floor(point.fx * width)), Math.min(height - 1, Math.floor(point.fy * height)));
    samples[k * 4] = word & 255;
    samples[k * 4 + 1] = (word >>> 8) & 255;
    samples[k * 4 + 2] = (word >>> 16) & 255;
  });
  return samples;
}
