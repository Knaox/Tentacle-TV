/**
 * Ce que montre chaque VIGNETTE de la fin d'un média — sept classes.
 *
 * Les vignettes trickplay (320 px, une toutes les dix secondes) ne disent pas ce
 * qu'est un générique ; elles disent si l'image porte du TEXTE, et sur quel
 * fond. C'est ce qui manquait au premier détecteur, qui ne voyait que « sombre
 * et terne » : une scène de nuit presque noire (« Les Gardiens de la Galaxie
 * 3 », 110:40, noir 0,99, saturation 2,4) passait pour un générique, et un
 * défilement si dense qu'il éclaircit l'image (« Endgame », noir 0,56) passait
 * pour une scène.
 *
 * La mesure qui tranche : les RANGÉES DE TEXTE — la part des lignes de pixels
 * qui portent au moins 4 % de transitions nettes (écart de luminance ≥ 50 entre
 * deux voisins). Un défilement en porte 0,20 à 0,55 ; une scène sombre, zéro.
 * Mais une ville de nuit aussi en porte (des lumières piquées sur du noir) :
 * d'où la seconde condition, le FOND — sombre, ou uni (la part des pixels à ±10
 * de la luminance médiane, « modal »). Le texte sur fond de couleur des
 * génériques d'animation (violet des « Nouveaux Héros », beige de « Vaiana 2 »)
 * passe par là.
 *
 *  - `T` défilement sur fond sombre : rangées ≥ 0,15, noir ≥ 0,5 ;
 *  - `L` texte sur fond clair ou coloré : rangées ≥ 0,15, fond uni (modal ≥
 *    0,45). Un dessin animé en aplats cernés de noir (« Rick et Morty ») y
 *    ressemble trait pour trait : c'est l'audio qui tranche (`tailTimeline.ts`),
 *    un aplat sous un dialogue est une scène ;
 *  - `C` carton sur noir : noir ≥ 0,9, rangées ≥ 0,02, fond uni ≥ 0,85 — un nom,
 *    une fonction, quelle que soit la couleur du texte (le jaune de « Joker ») ;
 *  - `K` noir pur : noir ≥ 0,9, aucune rangée, aucune couleur ;
 *  - `D` image sombre : noir ≥ 0,55 et saturation < 30 — une scène de nuit
 *    garde de la couleur (Thanos : 4 à 9) là où un carton n'en a pas ;
 *  - `U` aplat : fond uni ≥ 0,85 (les cartons rouges de « Deadpool ») ;
 *  - `E` image : tout le reste.
 */

export type CellKind = "T" | "L" | "C" | "K" | "U" | "D" | "E";

/** Ce qu'on mesure sur une vignette. */
export interface ThumbnailMeasure {
  /** Position de la vignette dans le média, en ms. */
  ms: number;
  /** Part de pixels quasi noirs (luminance < 24), de 0 à 1. */
  dark: number;
  /** Saturation moyenne (écart max-min des canaux), de 0 à 255. */
  saturation: number;
  /** Part des rangées de pixels qui portent du texte (voir l'en-tête). */
  rows: number;
  /** Part des pixels à ±10 de la luminance médiane : un fond uni. */
  modal: number;
}

export const TEXT_ROWS_MIN = 0.15;
const TEXT_DARK_MIN = 0.5;
const TEXT_MODAL_MIN = 0.45;
const CARD_DARK_MIN = 0.9;
const CARD_ROWS_MIN = 0.02;
const UNIFORM_MODAL_MIN = 0.85;
const BLACK_SATURATION_MAX = 1;
const SCENE_DARK_MIN = 0.55;
const SCENE_SATURATION_MAX = 30;

export function classifyCell(m: ThumbnailMeasure): CellKind {
  if (m.rows >= TEXT_ROWS_MIN && m.dark >= TEXT_DARK_MIN) return "T";
  if (m.rows >= TEXT_ROWS_MIN && m.modal >= TEXT_MODAL_MIN) return "L";
  if (m.dark >= CARD_DARK_MIN) {
    if (m.rows >= CARD_ROWS_MIN && m.modal >= UNIFORM_MODAL_MIN) return "C";
    if (m.rows < CARD_ROWS_MIN && m.saturation <= BLACK_SATURATION_MAX) return "K";
  }
  if (m.dark >= SCENE_DARK_MIN && m.saturation < SCENE_SATURATION_MAX) return "D";
  if (m.modal >= UNIFORM_MODAL_MIN) return "U";
  return "E";
}

const DARK_LEVEL = 24;
const EDGE_LEVEL = 50;
const ROW_TRANSITIONS_MIN = 0.04;
const MODAL_SPREAD = 10;

/**
 * Mesure une cellule d'une planche décodée (RGBA). Tous les pixels comptent :
 * les seuils ont été calés ainsi, et une transition se mesure entre VOISINS.
 */
export function measureCell(
  pixels: Uint8Array | Uint8ClampedArray,
  imageWidth: number,
  originX: number,
  originY: number,
  width: number,
  height: number,
  ms: number,
): ThumbnailMeasure {
  const histogram = new Uint32Array(256);
  const lum = new Float32Array(width * height);
  let dark = 0;
  let saturation = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = ((originY + y) * imageWidth + originX + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum[y * width + x] = l;
      histogram[Math.min(255, Math.round(l))]++;
      if (l < DARK_LEVEL) dark++;
      saturation += Math.max(r, g, b) - Math.min(r, g, b);
    }
  }
  const total = width * height;
  let textRows = 0;
  for (let y = 0; y < height; y++) {
    let transitions = 0;
    for (let x = 0; x + 1 < width; x++) {
      if (Math.abs(lum[y * width + x + 1] - lum[y * width + x]) >= EDGE_LEVEL) transitions++;
    }
    if (transitions / width >= ROW_TRANSITIONS_MIN) textRows++;
  }
  let seen = 0;
  let median = 0;
  for (let v = 0; v < 256; v++) {
    seen += histogram[v];
    if (seen * 2 >= total) {
      median = v;
      break;
    }
  }
  let modal = 0;
  for (let i = 0; i < total; i++) if (Math.abs(lum[i] - median) <= MODAL_SPREAD) modal++;
  return {
    ms,
    dark: dark / total,
    saturation: saturation / total,
    rows: textRows / height,
    modal: modal / total,
  };
}
