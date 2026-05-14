/**
 * Shared effect tokens — blur/shadow/glow constants for cross-platform usage.
 *
 * Pure module: ShadowRN values are React Native compatible (shadowColor,
 * shadowOffset, etc.) but expressed as plain JS objects — RN never imported.
 */

import { BRAND } from "./colors";

/** Blur radius in px — `expo-blur` maps `intensity` 0-100 (mobile). */
export const BLUR_INTENSITY = {
  subtle: 8,
  dropdown: 12,
  sheet: 16,
  modal: 20,
  overlay: 24,
} as const;

/** Shadow presets — RN-friendly (web uses computed `box-shadow` string). */
export const SHADOW_RN = {
  elev1: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 1,
  },
  elev2: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  elev3: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHover: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  sheet: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
} as const;

/** Violet brand glow — focus rings, primary CTA halos. */
export const GLOW_VIOLET = {
  shadowColor: BRAND.violet,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.45,
  shadowRadius: 12,
  elevation: 6,
} as const;

export type BlurTier = keyof typeof BLUR_INTENSITY;
export type ShadowTier = keyof typeof SHADOW_RN;
