import { DEFAULT_THEME_TOKENS } from "../defaults";
import { mergeThemeTokens } from "../merge";
import {
  TV_HERO_AMBILIGHT,
  TV_OVERSCAN,
  TV_PLAYER_LAYERS,
} from "../tokens/tvOnly";
import { TV_THEME_TOKEN_OVERRIDES } from "../tokens/tv";
import { parsePx, parseShadow, type NativeShadow } from "./units";

/**
 * La couche téléviseur, vue par React Native.
 *
 * Même source que webOS — `TV_THEME_TOKEN_OVERRIDES` et `tvOnly` — mais rendue
 * en nombres. C'est ici que se joue la propagation : une valeur changée dans
 * `tokens/tv.ts` bouge la LG (par variable CSS) ET l'Apple TV / l'Android TV
 * (par cet objet), sans qu'on ait à y penser.
 *
 * Les couleurs restent des chaînes : React Native les accepte telles quelles,
 * y compris les formes `rgba(…)`. Seules les grandeurs — rayons, ombres,
 * overscan, flou — demandent une conversion.
 *
 * Attention : `border.focus` vaut `rgba(var(--brand-rgb), 1)` côté CSS, une
 * référence que React Native ne sait pas résoudre. Elle est donc écartée ici et
 * l'anneau de focus natif se construit sur la couleur de marque résolue.
 */

const TV_TOKENS = mergeThemeTokens(DEFAULT_THEME_TOKENS, TV_THEME_TOKEN_OVERRIDES);

/** Rayons du téléviseur, en points. */
export const TV_RADIUS = {
  xs: parsePx(TV_TOKENS.radius.xs),
  sm: parsePx(TV_TOKENS.radius.sm),
  md: parsePx(TV_TOKENS.radius.md),
  lg: parsePx(TV_TOKENS.radius.lg),
  xl: parsePx(TV_TOKENS.radius.xl),
  /** 9999 côté CSS ; en natif un grand nombre suffit et évite les artefacts de
   * rastérisation qu'un rayon démesuré provoque sur certaines dalles. */
  pill: 999,
} as const;

/** Le retrait d'overscan, en points. */
export const TV_OVERSCAN_PT = {
  x: parsePx(TV_OVERSCAN.x),
  y: parsePx(TV_OVERSCAN.y),
} as const;

/** Le halo de bannière, en nombres.
 *
 *  Il n'y a PAS de `TV_AMBILIGHT_BLUR` : un rayon en pixels d'écran branché
 *  sur `<Image blurRadius>`, qui compte en pixels de bitmap, est exactement ce
 *  qui a produit la plaque grise. Ce qui se transpose, c'est le RAPPORT du
 *  flou à la largeur de la carte ; le rayon s'en déduit à la mesure, par
 *  plateforme (`@tentacle-tv/tv-core` → `reglageFlouAndroid`).
 *
 *  `saturation` n'a pas d'équivalent dans `<Image>` : elle passe par le filtre
 *  SVG du chemin tvOS. Le repli Android s'en dispense — voir
 *  `TVHeroAmbilightFiltre`. */
export const TV_AMBILIGHT = {
  rapportFlou: parsePx(TV_HERO_AMBILIGHT.blur) / parsePx(TV_HERO_AMBILIGHT.largeurCarteReference),
  largeurSource: TV_HERO_AMBILIGHT.largeurSource,
  couches: TV_HERO_AMBILIGHT.couches,
  saturation: Number.parseFloat(TV_HERO_AMBILIGHT.saturation),
  plancher: TV_HERO_AMBILIGHT.alphaPlancher,
} as const;

/** Les rangs de peinture du lecteur — mêmes valeurs que la feuille webOS. */
export const TV_LAYERS = TV_PLAYER_LAYERS;

/** Surfaces et bordures, telles quelles (React Native lit ces chaînes). */
export const TV_COLORS = {
  glassTint: TV_TOKENS.color.glass.tint,
  glassTintStrong: TV_TOKENS.color.glass.tintStrong,
  glassPanel: TV_TOKENS.color.glass.panel,
  glassBackdrop: TV_TOKENS.color.glass.backdrop,
  surfaceModal: TV_TOKENS.color.surface.modal,
  surfaceDropdown: TV_TOKENS.color.surface.dropdown,
  surfaceSheet: TV_TOKENS.color.surface.sheet,
  surfaceToolbar: TV_TOKENS.color.surface.toolbar,
  surfaceOverlay: TV_TOKENS.color.surface.overlay,
  borderSubtle: TV_TOKENS.color.border.subtle,
  borderStrong: TV_TOKENS.color.border.strong,
} as const;

const shadowOrThrow = (value: string, name: string): NativeShadow => {
  const parsed = parseShadow(value);
  if (!parsed) {
    // Un jeton d'ombre illisible ne doit pas se dégrader en silence : une ombre
    // manquante sur une dalle, c'est la carte focalisée qui cesse de décoller,
    // donc l'utilisateur qui ne sait plus où il est.
    throw new Error(`Jeton d'ombre illisible (${name}) : ${value}`);
  }
  return parsed;
};

/** Les trois élévations, en style d'ombre natif. */
export const TV_SHADOW: Record<"elev1" | "elev2" | "elev3", NativeShadow> = {
  elev1: shadowOrThrow(TV_TOKENS.shadow.elev1, "elev1"),
  elev2: shadowOrThrow(TV_TOKENS.shadow.elev2, "elev2"),
  elev3: shadowOrThrow(TV_TOKENS.shadow.elev3, "elev3"),
};
