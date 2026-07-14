/**
 * Adaptateur @callstack/liquid-glass — require dynamique (même pattern que
 * SecureStore dans RNStorageAdapter) : robuste si le module natif est absent
 * (Android, ancien build, Expo Go). Fabric-only, iOS 26+ ; sur tout autre
 * environnement `getLiquidGlassModule()` renvoie null ou
 * `isLiquidGlassSupported` est false → GlassSurface rend le fallback blur.
 */

import type { ComponentType, ReactNode } from "react";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";

export const LIQUID_GLASS_STORAGE_KEY = "tentacle_liquid_glass";

export interface LiquidGlassViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** "regular" = verre dépoli (défaut lib), "clear" = transparent, "none". */
  effect?: "clear" | "regular" | "none";
  interactive?: boolean;
  tintColor?: ColorValue;
  colorScheme?: "light" | "dark" | "system";
}

export interface LiquidGlassModule {
  LiquidGlassView: ComponentType<LiquidGlassViewProps>;
  LiquidGlassContainerView: ComponentType<{
    spacing?: number;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
  }>;
  isLiquidGlassSupported: boolean;
}

let cached: LiquidGlassModule | null | undefined;

export function getLiquidGlassModule(): LiquidGlassModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@callstack/liquid-glass") as Partial<LiquidGlassModule>;
    cached =
      mod && typeof mod.isLiquidGlassSupported === "boolean" && mod.LiquidGlassView
        ? (mod as LiquidGlassModule)
        : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** true ssi le module est chargeable ET l'OS supporte le rendu (iOS 26+). */
export function isLiquidGlassAvailable(): boolean {
  const mod = getLiquidGlassModule();
  return !!mod && mod.isLiquidGlassSupported;
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
