/**
 * Adaptateur Liquid Glass — bascule sur la lib OFFICIELLE `expo-glass-effect`
 * (GlassView natif iOS 26 via UIVisualEffectView) au lieu de
 * `@callstack/liquid-glass` (flag `isLiquidGlassSupported` non fiable + bugs de
 * rendu connus sur iOS 26.1+ : verre transparent au 1er rendu, incohérent sur
 * device physique — issues callstack/liquid-glass #27/#33).
 *
 * `require` dynamique (robuste si le module natif est absent : Android, ancien
 * build, Expo Go) : sur tout autre environnement `getLiquidGlassModule()`
 * renvoie null ou `isLiquidGlassAvailable()` est false → GlassSurface rend le
 * fallback blur.
 */

import type { ComponentType, ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";

export const LIQUID_GLASS_STORAGE_KEY = "tentacle_liquid_glass";

/** Props de `GlassView` (expo-glass-effect) réellement utilisées. */
export interface LiquidGlassViewProps extends ViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** "regular" = verre dépoli (défaut), "clear" = transparent, "none". */
  glassEffectStyle?: "clear" | "regular" | "none";
  isInteractive?: boolean;
  tintColor?: string;
  colorScheme?: "auto" | "light" | "dark";
}

export interface LiquidGlassModule {
  GlassView: ComponentType<LiquidGlassViewProps>;
  isLiquidGlassAvailable: () => boolean;
}

let cached: LiquidGlassModule | null | undefined;

export function getLiquidGlassModule(): LiquidGlassModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-glass-effect") as Partial<LiquidGlassModule>;
    cached =
      mod && mod.GlassView && typeof mod.isLiquidGlassAvailable === "function"
        ? (mod as LiquidGlassModule)
        : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** true ssi le vrai Liquid Glass Apple est disponible (iOS 26+, API présente). */
export function isLiquidGlassAvailable(): boolean {
  const mod = getLiquidGlassModule();
  try {
    return !!mod && mod.isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

// ── Amorçage pré-mount (même pattern que themeMode.bootMode) ────────────────
// index.js lit la clé AsyncStorage AVANT le mount et la pose ici ; le
// ThemeProvider s'initialise depuis getBootLiquidGlassEnabled() — pas de
// course avec l'hydratation du RNStorageAdapter. Défaut : ACTIVÉ quand
// supporté (feature vitrine, opt-out).

let bootEnabled = true;

export function setBootLiquidGlassEnabled(raw: string | null): void {
  bootEnabled = raw === null ? true : raw === "true";
}

export function getBootLiquidGlassEnabled(): boolean {
  return bootEnabled;
}
