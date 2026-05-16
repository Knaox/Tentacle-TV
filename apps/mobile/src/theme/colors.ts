/**
 * Mobile colour namespace — back-compat keys consumed by ~48 screens.
 *
 * EACH PROPERTY IS A GETTER reading live from the shared theme exports.
 * When `applyThemeOverride()` is called at boot (after `/api/theme` fetch),
 * the shared exports mutate in place and inline-style consumers reading
 * `colors.background` etc. immediately see the new values. Module-level
 * StyleSheet.create captures snapshot the values at import time — those
 * remain frozen until the bundle reloads.
 */

import { BORDER, BRAND, OVERLAY, STATUS, SURFACE, TEXT } from "@tentacle-tv/shared";

interface MobileColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceElevated: string;
  readonly accent: string;
  readonly accentHover: string;
  readonly accentMuted: string;
  readonly accentLight: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly textDim: string;
  readonly danger: string;
  readonly dangerSurface: string;
  readonly dangerBorder: string;
  readonly success: string;
  readonly gold: string;
  readonly border: string;
  readonly borderAccent: string;
  readonly glass: string;
  readonly glassLight: string;
  readonly overlay: string;
  readonly tabBar: string;
}

export const colors: MobileColors = {
  // Surfaces
  get background() { return SURFACE.s0; },
  get surface() { return SURFACE.s1; },
  get surfaceElevated() { return SURFACE.s2; },

  // Brand violet
  get accent() { return BRAND.violet; },
  get accentHover() { return BRAND.dark; },
  get accentMuted() { return BRAND.soft; },
  get accentLight() { return BRAND.light; },

  // Text hierarchy
  get textPrimary() { return TEXT.primary; },
  get textSecondary() { return TEXT.secondary; },
  get textMuted() { return TEXT.tertiary; },
  get textDim() { return TEXT.quaternary; },

  // Status
  get danger() { return STATUS.error; },
  dangerSurface: "rgba(239, 68, 68, 0.1)",
  dangerBorder: "rgba(239, 68, 68, 0.2)",
  get success() { return STATUS.success; },
  get gold() { return STATUS.rating; },

  // Borders
  get border() { return BORDER.subtle; },
  get borderAccent() { return BRAND.soft; },

  // Glass (neutral — not theme-derived)
  glass: "rgba(20, 20, 26, 0.85)",
  glassLight: "rgba(20, 20, 26, 0.5)",

  // Overlay + tab bar
  get overlay() { return OVERLAY.scrim; },
  tabBar: "rgba(0, 0, 0, 0.92)",
};
