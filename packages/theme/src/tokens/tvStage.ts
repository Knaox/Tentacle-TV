/**
 * La scène de la refonte TV — ce que la distance (3 m) et le canevas
 * 1920 × 1080 imposent aux vues d'Apple TV et d'Android TV.
 *
 * Les couleurs, le verre et les boutons restent CEUX DU BUREAU
 * (`DEFAULT_COLOR_TOKENS`) : ce fichier ne porte que ce que le salon change —
 * l'échelle des textes, les gabarits, le focus, et l'accent. Valeurs natives
 * (nombres en points), pas de CSS : webOS les reprendra à part.
 *
 * L'accent EST la marque du bureau, violet → rose (`brand.base` →
 * `brand.accent`), en TOUCHES : le bouton de lecture, les barres de
 * progression, les étoiles, les états posés, les surtitres — et la lumière
 * des halos. Jamais un fond plein cadre : « pas trop violet, mais qu'on
 * remarque l'identité » (retour de l'utilisateur, 2026-09-30).
 */

import { DEFAULT_COLOR_TOKENS } from "./colors";

const BRAND = DEFAULT_COLOR_TOKENS.brand;

export const TV_ACCENT = {
  /** Le rose de marque : les touches pleines (pastilles, étoiles, points). */
  base: BRAND.accent,
  /** Rose clair : textes et pictogrammes posés sur le sombre. */
  light: BRAND.accentLight,
  /** Le violet de marque : départ du dégradé, accent posé sur du blanc. */
  deep: BRAND.base,
  /** Texte posé sur l'accent (et sur le dégradé). */
  onAccent: "#FFFFFF",
  /** Le dégradé de marque, violet → rose : lecture, progression, « Demander ». */
  gradient: [BRAND.base, BRAND.accent] as readonly [string, string],
  /** La lueur d'un élément de marque (rose, comme `--progress-glow`). */
  glow: `rgba(${BRAND.accentRgb}, 0.55)`,
} as const;

/** Échelle des textes, en points 1080p. Plancher : 22. */
export const TV_TYPE = {
  display: 96,
  displayLineHeight: 96,
  title: 56,
  heading: 40,
  rowTitle: 36,
  body: 27,
  bodyLineHeight: 38,
  meta: 24,
  button: 26,
  nav: 26,
  kicker: 22,
  caption: 22,
} as const;

/** Les gabarits de la scène. */
export const TV_STAGE = {
  /** Marge de sécurité : texte et éléments focalisables seulement. */
  safe: { x: 96, y: 54 },
  nav: {
    left: 36,
    top: 40,
    bottom: 40,
    collapsedWidth: 104,
    expandedWidth: 380,
    radius: 46,
    itemHeight: 64,
    itemRadius: 24,
    icon: 28,
  },
  /** Où commence le contenu : après la navigation repliée. */
  contentLeft: 176,
  hero: { top: 56, height: 640, radius: 40, haloSpread: 26 },
  row: { gap: 36, titleGap: 22, spacing: 64 },
  card: {
    landscape: { width: 380, height: 214, radius: 22 },
    poster: { width: 240, height: 360, radius: 20 },
    person: { size: 176 },
  },
  focus: {
    cardScale: 1.08,
    buttonScale: 1.06,
    /** Ce qui n'a pas le focus recule, sans disparaître. */
    recede: 0.72,
    durationMs: 220,
  },
  radius: { chip: 999, sheet: 36, panel: 32, button: 999 },
} as const;
