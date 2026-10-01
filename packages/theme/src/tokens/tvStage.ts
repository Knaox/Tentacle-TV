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
  /** La navigation (Apple TV) : des capsules qui épousent leur contenu —
   *  repliée, une bande d'icônes en pilule ; ouverte, la largeur du texte le
   *  plus long, entre `minExpandedWidth` et `expandedWidth`. */
  nav: {
    left: 44,
    top: 40,
    bottom: 40,
    collapsedWidth: 88,
    minExpandedWidth: 300,
    expandedWidth: 380,
    radius: 44,
    itemHeight: 64,
    itemRadius: 24,
    icon: 28,
  },
  /** Où commence le contenu : après la navigation repliée. */
  contentLeft: 176,
  hero: {
    top: 56,
    height: 640,
    radius: 40,
    haloSpread: 10,
    /** La force du halo du héros : discret, « plus discret, vraiment » —
     *  0,3 est un plafond (retours du 2026-10-01). Une ligne pour le régler. */
    haloOpacity: 0.28,
  },
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

/**
 * La lumière de la scène (Apple TV) — retour de l'essai sur l'appareil du
 * 2026-10-01 : « dans une bibliothèque pleine de cartes, la carte focalisée
 * donne l'impression d'un grand noir derrière ». Trois leviers, dosés au banc
 * (`docs/TV-REFONTE.md`, « La lumière des fonds ») :
 * - le fond n'est plus le noir pur du bureau mais une ENCRE à peine teintée
 *   de la marque, plus claire en haut — jamais un fond violet ;
 * - la lumière de l'œuvre focalisée couvre toute la scène, d'en haut et des
 *   deux côtés (`AmbientBackdrop`) ;
 * - la carte focalisée jette SA lumière autour d'elle, au lieu d'une ombre
 *   noire (`CardFrame`).
 *
 * Le texte garde son contraste : sous la lumière la plus forte, le texte
 * tertiaire (blanc 0,55) reste au-dessus de 4,5:1 — `maxLuminance` borne la
 * clarté d'une lumière, quelle que soit l'œuvre (au pire, un jaune vif : 5:1
 * en haut de l'écran, 4,4:1 sans la borne).
 */
export const TV_LIGHT = {
  /** L'encre du fond, de haut en bas ; `topRgb` pour un voile qui s'y fond. */
  ink: { top: "#100D17", bottom: "#09080E", topRgb: "16, 13, 23" },
  /** Les lumières de l'œuvre (opacités) : d'en haut, à gauche, à droite. */
  ambient: { key: 0.32, left: 0.26, right: 0.24, maxLuminance: 0.4 },
  /** La lueur de la carte focalisée — une ombre colorée, une seule couche.
   *  `neutral` : une carte qui doit rester grise (hors bibliothèque) garde
   *  une lueur blanche, douce et basse. */
  cardGlow: { opacity: 0.7, radius: 46, offsetY: 18, neutral: "#FFFFFF", neutralOpacity: 0.18 },
  /** Le halo de la marque derrière le logo, sur l'encre : la recette du halo
   *  des icônes de `brand/` (magenta au cœur, violet au bord). */
  brandHalo: { inner: "#C026D3", outer: "#A855F7", opacity: 0.75 },
} as const;
