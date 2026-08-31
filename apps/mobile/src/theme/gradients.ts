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
