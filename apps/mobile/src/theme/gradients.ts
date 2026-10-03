import { mixHex } from "@tentacle-tv/theme";

import type { ThemePalette } from "@tentacle-tv/theme";

/**
 * Les dégradés de marque violet → rose, transposés du web en props prêtes
 * pour `expo-linear-gradient`.
 *
 * Deux recettes, mêmes arrêts que les variables CSS du desktop :
 *  - `progressGradient` = `--progress-fill` (90°, violet → rose) — barres de
 *    progression, seek bar ;
 *  - `ctlGradient` = `--ctl-gradient` (135°, violet → mi-chemin → rose) —
 *    contrôles pleins (segments, interrupteurs).
 *
 * Les fonctions consomment la palette AU RENDU (jamais de constante figée) :
 * le thème admin et le schéma clair/sombre traversent sans code de plus.
 */

export interface GradientSpec {
  colors: [string, string, ...string[]];
  locations?: [number, number, ...number[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

type BrandSlice = ThemePalette["brand"];

/** `--progress-fill` : violet → rose, horizontal. */
export function progressGradient(brand: BrandSlice): GradientSpec {
  return {
    colors: [brand.violet, brand.accent],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  };
}

/** `--ctl-gradient` : violet → point médian (color-mix 50/50) → rose, 135°. */
export function ctlGradient(brand: BrandSlice): GradientSpec {
  return {
    colors: [brand.violet, mixHex(brand.violet, brand.accent, 0.5, "#A855F7"), brand.accent],
    locations: [0, 0.55, 1],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  };
}

/**
 * La pastille de la saison affichée : le dégradé de marque en version
 * PROFONDE (`--season-tab-gradient` du bureau). Le dégradé des contrôles tombe
 * à 3,5:1 sous un libellé blanc à son extrémité rose ; celui-ci tient 4,6:1
 * d'un bout à l'autre.
 */
export function seasonTabGradient(brand: BrandSlice): GradientSpec {
  return {
    colors: [brand.dark, mixHex(brand.dark, brand.accentLight, 0.5, "#9333EA"), brand.accentDark],
    locations: [0, 0.55, 1],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  };
}

/**
 * `--cta-brand-gradient` : le bouton de LECTURE (héros, fiche, feuille des
 * cartes) — le dégradé de marque de l'Apple TV, un cran plus profond
 * (`dark` → `accentDark`), ~120°. Le vif (`violet` → `accent`) tombe à 3,5:1
 * sous un libellé blanc de 16 pt ; celui-ci tient 4,6:1 d'un bout à l'autre,
 * dans les deux schémas (test `gradients.test.ts`).
 */
export function ctaGradient(brand: BrandSlice): GradientSpec {
  return {
    colors: [brand.dark, brand.accentDark],
    start: { x: 0, y: 0.2 },
    end: { x: 1, y: 0.8 },
  };
}
