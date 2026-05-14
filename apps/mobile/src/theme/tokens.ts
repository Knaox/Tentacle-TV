/**
 * Mobile theme hub — consomme `@tentacle-tv/shared/theme` (source unique de
 * vérité cross-platform) et expose une API React Native + ajouts mobile-only.
 *
 * Ne pas importer ce fichier dans les écrans existants — utiliser plutôt
 * `colors`/`typography`/`spacing` re-exportés depuis `./index.ts` qui sont
 * back-compat (mêmes clés qu'avant la refonte). Ce hub est consommé par les
 * NOUVEAUX composants UI (Button, GlassCard refondu, Hero, etc.).
 */

import type { TextStyle, ViewStyle } from "react-native";
import {
  BRAND,
  SURFACE,
  TEXT,
  STATUS,
  STATUS_PAIRS,
  BORDER,
  CTA,
  OVERLAY,
  SPACING,
  RADIUS,
  LAYOUT,
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE,
  LETTER_SPACING,
  LINE_HEIGHT,
  TYPE_PRESETS,
  DURATIONS,
  EASINGS_BEZIER,
  SPRINGS,
  MOTION_PRESETS,
  BLUR_INTENSITY,
  SHADOW_RN,
  GLOW_VIOLET,
} from "@tentacle-tv/shared";

// Re-export cross-platform tokens
export {
  BRAND,
  SURFACE,
  TEXT,
  STATUS,
  STATUS_PAIRS,
  BORDER,
  CTA,
  OVERLAY,
  SPACING,
  RADIUS,
  LAYOUT,
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE,
  LETTER_SPACING,
  LINE_HEIGHT,
  TYPE_PRESETS,
  DURATIONS,
  EASINGS_BEZIER,
  SPRINGS,
  MOTION_PRESETS,
  BLUR_INTENSITY,
  SHADOW_RN,
  GLOW_VIOLET,
};

// ─── Mobile-only additions ──────────────────────────────────────────────────

/**
 * Haptic feedback intensities — wrapped by `useHapticFeedback`.
 * Matches `expo-haptics` ImpactFeedbackStyle + NotificationFeedbackType names.
 */
export const HAPTICS = {
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  success: "Success",
  warning: "Warning",
  error: "Error",
  selection: "Selection",
} as const;

export type HapticKind = keyof typeof HAPTICS;

/** Safe area defaults (fallback before `useSafeAreaInsets` resolves). */
export const SAFE_AREA = {
  statusBarMin: 20,
  bottomBarMin: 8,
  notchSide: 0,
} as const;

/**
 * Helper renvoyant la fontFamily Inter correspondant à un poids logique.
 * Utile pour les composants RN qui font `style={{ fontFamily: getFont("bold") }}`.
 */
export function getFont(weight: keyof typeof FONT_FAMILY = "regular"): string {
  return FONT_FAMILY[weight];
}

/**
 * Construit un TextStyle complet à partir d'un preset typographique partagé —
 * injecte la `fontFamily` Inter en plus du fontSize/fontWeight/letterSpacing.
 */
export function preset(name: keyof typeof TYPE_PRESETS, fontWeight?: keyof typeof FONT_FAMILY): TextStyle {
  const p = TYPE_PRESETS[name];
  // Map weight to font family slot — defaults to a sensible match per preset.
  const weightKey: keyof typeof FONT_FAMILY = fontWeight ?? weightForPreset(name);
  return {
    fontSize: p.fontSize,
    fontWeight: p.fontWeight as TextStyle["fontWeight"],
    letterSpacing: p.letterSpacing,
    fontFamily: FONT_FAMILY[weightKey],
  };
}

function weightForPreset(name: keyof typeof TYPE_PRESETS): keyof typeof FONT_FAMILY {
  switch (name) {
    case "display1": return "extrabold";
    case "display2":
    case "display3": return "bold";
    case "heading1":
    case "heading2":
    case "heading3": return "semibold";
    case "bodyBold":
    case "small":
    case "badge": return "semibold";
    case "body":
    case "caption":
    default: return "regular";
  }
}

/** ViewStyle helper for the cinematic vertical fade used by Hero billboards. */
export const HERO_FADE_HEIGHT = 240;

/** Re-exported shadow alias for convenience. */
export type RNShadow = ViewStyle;
