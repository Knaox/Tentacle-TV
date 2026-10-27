// Banc lg8 — le contraste mesuré sur la capture composite (verre natif + page +
// vidéo de mpv), par DIFFÉRENCE de deux captures d'une image FIXE :
//   « pleine » : tout le lecteur ; « nue » : textes, glyphes et barre rendus invisibles.
// Le masque des pixels qui changent EST le premier plan d'un élément ; ce qui reste
// sous lui dans la capture nue EST son fond (verre, voile, vidéo — ce que l'œil voit).
// Pur (aucun effet) : se teste hors de l'app (`node lg8/contrast.selftest.mjs`).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const SRGB_PROFILE = "/System/Library/ColorSync/Profiles/sRGB Profile.icc";

/** Une capture PNG en RVB 8 bits, ramenée en sRGB (l'écran peut être en Display P3). */
export function readRgb(file) {
  const profile = existsSync(SRGB_PROFILE) ? ["-profile", SRGB_PROFILE] : [];
  const [width, height] = execFileSync("magick", ["identify", "-format", "%w %h", file], { encoding: "utf8" }).split(" ").map(Number);
  const data = execFileSync("magick", [file, ...profile, "-depth", "8", "rgb:-"], { maxBuffer: 256 * 1024 * 1024 });
  return { width, height, data };
}

const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const LIN = Float64Array.from({ length: 256 }, (_, i) => lin(i));

/** Luminance relative WCAG d'un pixel sRGB. */
export const luminance = (r, g, b) => 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];

/** Rapport de contraste WCAG entre deux luminances. */
export const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];

/**
 * Le contraste d'UN élément. `box` en pixels de capture ({x, y, w, h}).
 * - premier plan : les pixels qui changent entre les captures (écart ≥ `delta`
 *   sur un canal) ; son cœur = les 40 % qui changent le plus (l'intérieur des
 *   traits, pas l'anticrénelage) ; sa luminance = la médiane du cœur ;
 * - fond : la capture NUE sur toute la boîte, côté le PLUS défavorable
 *   (90e centile pour un premier plan clair, 10e pour un sombre) — un texte blanc
 *   sur du bruit est jugé sur les blocs blancs, pas sur la moyenne.
 * Rend aussi le contraste « médian » (fond médian), pour situer.
 */
export function elementContrast(full, bare, box, { delta = 20, pad = 2 } = {}) {
  const x0 = Math.max(0, Math.floor(box.x) - pad);
  const y0 = Math.max(0, Math.floor(box.y) - pad);
  const x1 = Math.min(full.width, Math.ceil(box.x + box.w) + pad);
  const y1 = Math.min(full.height, Math.ceil(box.y + box.h) + pad);
  const fg = [];
  const bg = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * full.width + x) * 3;
      const a = full.data;
      const b = bare.data;
      const lb = luminance(b[i], b[i + 1], b[i + 2]);
      bg.push(lb);
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (d >= delta) {
        const lf = luminance(a[i], a[i + 1], a[i + 2]);
        fg.push([Math.abs(lf - lb), lf]);
      }
    }
  }
  if (fg.length < 6 || bg.length === 0) return { measured: false, pixels: fg.length };
  fg.sort((p, q) => q[0] - p[0]);
  const core = fg.slice(0, Math.max(3, Math.round(fg.length * 0.4))).map((p) => p[1]).sort((p, q) => p - q);
  const fgL = quantile(core, 0.5);
  bg.sort((p, q) => p - q);
  const bgMid = quantile(bg, 0.5);
  const light = fgL >= bgMid;
  const bgWorst = light ? quantile(bg, 0.9) : quantile(bg, 0.1);
  return {
    measured: true,
    pixels: fg.length,
    fg: round(fgL),
    bg: round(bgWorst),
    contrast: round(ratio(fgL, bgWorst), 2),
    median: round(ratio(fgL, bgMid), 2),
    polarity: light ? "clair" : "sombre",
  };
}

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/** Seuils du lot : 4,5:1 pour le texte, 3:1 pour les glyphes et la barre. */
export const THRESHOLD = { texte: 4.5, glyphe: 3, barre: 3 };

export function verdict(kind, result) {
  if (!result.measured) return "—";
  return result.contrast >= THRESHOLD[kind] ? "OK" : "ÉCHEC";
}
