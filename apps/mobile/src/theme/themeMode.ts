/**
 * Mode d'apparence (clair / sombre / auto) — persistance et amorçage.
 *
 * Le mode est un réglage PAR APPAREIL (clé RNStorageAdapter/AsyncStorage),
 * comme le réglage d'apparence de l'OS — pas de synchro serveur.
 *
 * Séquence de boot sans flash ni course :
 *  1. `index.js` lit la clé AsyncStorage AVANT le mount d'ExpoRoot et appelle
 *     `setBootThemeMode()` — qui applique aussi `Appearance.setColorScheme`,
 *     donc `useColorScheme()` est correct dès le tout premier render ET les
 *     éléments natifs (alerts, clavier, menus) suivent.
 *  2. Le ThemeProvider s'initialise depuis `getBootThemeMode()` (jamais depuis
 *     un storage potentiellement pas encore hydraté).
 */

import { Appearance } from "react-native";

import type { ThemeMode } from "./palette.types";

export const THEME_MODE_STORAGE_KEY = "tentacle_theme_mode";

const VALID_MODES: readonly ThemeMode[] = ["light", "dark", "auto"];

/**
 * Défaut "dark" : sans choix explicite, l'app est SOMBRE — comme sur le web et
 * le bureau, dont ce fichier est le miroir React Native (`packages/theme`
 * n'est pas importable ici, l'amorçage court avant le mount).
 *
 * Un même compte ne peut pas ouvrir en sombre sur l'ordinateur et en clair sur
 * le téléphone : c'est le même produit, et toute son identité visuelle est
 * construite pour le noir. "auto" reste choisissable, il n'est plus le défaut.
 */
export function sanitizeThemeMode(value: string | null | undefined): ThemeMode {
  return (VALID_MODES as readonly string[]).includes(value ?? "")
    ? (value as ThemeMode)
    : "dark";
}

/**
 * Répercute le mode au niveau OS : `null` en auto (suit le système), sinon
 * force le scheme — iOS `overrideUserInterfaceStyle` / Android
 * `AppCompatDelegate`, ce qui aligne aussi tous les éléments natifs.
 */
export function applyAppearance(mode: ThemeMode): void {
  Appearance.setColorScheme(mode === "auto" ? null : mode);
}

let bootMode: ThemeMode = "dark";

/** Appelé par index.js PRÉ-MOUNT — fixe le mode initial et l'applique à l'OS. */
export function setBootThemeMode(mode: ThemeMode): void {
  bootMode = mode;
  applyAppearance(mode);
}

/** État initial du ThemeProvider (source unique, posée pré-mount). */
export function getBootThemeMode(): ThemeMode {
  return bootMode;
}
