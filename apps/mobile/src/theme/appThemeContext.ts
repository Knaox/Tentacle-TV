/**
 * Contextes du système d'apparence.
 *
 * Deux contextes séparés pour limiter les re-renders :
 *  - `AppThemeContext`  : le thème résolu (change au switch de scheme) —
 *    consommé par TOUT composant qui affiche des couleurs.
 *  - `ThemePrefsContext` : le choix utilisateur + prefs Liquid Glass —
 *    consommé uniquement par les écrans de réglages.
 *
 * La valeur par défaut (hors provider : ErrorBoundary, tests) est un thème
 * sombre construit sur les tokens partagés au chargement du module.
 */

import { createContext, useContext } from "react";

import { buildDarkPalette } from "./palette.dark";
import { buildLightPalette } from "./palette.light";
import type { AppTheme, ResolvedScheme, ThemeMode } from "./palette.types";

/** Construit le thème résolu pour un scheme donné (palettes brand-aware). */
export function buildAppTheme(scheme: ResolvedScheme): AppTheme {
  const isDark = scheme === "dark";
  return {
    scheme,
    isDark,
    colors: isDark ? buildDarkPalette() : buildLightPalette(),
    statusBarStyle: isDark ? "light" : "dark",
    blurTint: scheme,
  };
}

export const DEFAULT_APP_THEME: AppTheme = buildAppTheme("dark");

export const AppThemeContext = createContext<AppTheme>(DEFAULT_APP_THEME);

export interface LiquidGlassPrefs {
  /** true ssi le module natif est présent ET l'OS le supporte (iOS 26+). */
  supported: boolean;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export interface ThemePrefsValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  liquidGlass: LiquidGlassPrefs;
}

export const ThemePrefsContext = createContext<ThemePrefsValue>({
  mode: "dark",
  setMode: () => {},
  liquidGlass: { supported: false, enabled: false, setEnabled: () => {} },
});

/** Thème d'apparence résolu (couleurs light/dark actives). */
export function useTheme(): AppTheme {
  return useContext(AppThemeContext);
}

/** Choix de mode + prefs Liquid Glass (écrans de réglages). */
export function useThemeMode(): ThemePrefsValue {
  return useContext(ThemePrefsContext);
}
