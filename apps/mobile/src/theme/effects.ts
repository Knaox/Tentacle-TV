/**
 * Effets visuels mobile — shadows ViewStyle, glow violet, helper blur.
 * Consomme `@tentacle-tv/shared/theme/effects`.
 */

import type { ViewStyle } from "react-native";
import { BLUR_INTENSITY, GLOW_VIOLET, SHADOW_RN } from "@tentacle-tv/shared";

export const shadows = {
  elev1: SHADOW_RN.elev1 as ViewStyle,
  elev2: SHADOW_RN.elev2 as ViewStyle,
  elev3: SHADOW_RN.elev3 as ViewStyle,
  cardHover: SHADOW_RN.cardHover as ViewStyle,
  sheet: SHADOW_RN.sheet as ViewStyle,
} as const;

export const glow = GLOW_VIOLET as ViewStyle;

/**
 * Maps `BLUR_INTENSITY` (px-equivalent) to `expo-blur` `intensity` 0-100.
 * Mapping empirique : 8px → 30, 16px → 60, 24px → 90.
 */
export function blurIntensity(tier: keyof typeof BLUR_INTENSITY): number {
  const px = BLUR_INTENSITY[tier];
  // px 8-24 → intensity 30-95 (linéaire)
  return Math.round(Math.min(95, Math.max(20, (px - 4) * 4.5)));
}

export { BLUR_INTENSITY };
